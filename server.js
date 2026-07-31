require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const MODELS_PATH = path.join(__dirname, 'config', 'models.json');
const SYSTEM_PROMPT_PATH = path.join(__dirname, 'config', 'systemPrompt.txt');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const IDLE_TIMEOUT_MS = 15000; // 최초 연결 또는 청크 사이 최대 대기 시간
const MAX_TOKENS = 300;

app.use(cors());
app.use(express.json());

// Serve static files (index.html, etc.) from the project root
app.use(express.static(__dirname));

function loadModels() {
  const raw = fs.readFileSync(MODELS_PATH, 'utf-8');
  const models = JSON.parse(raw);
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error('config/models.json에 모델이 하나 이상 있어야 합니다.');
  }
  return models;
}

function loadSystemPrompt() {
  const raw = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8').trim();
  if (!raw) {
    throw new Error('config/systemPrompt.txt가 비어 있습니다.');
  }
  return raw;
}

/**
 * OpenRouter에 stream:true로 요청하고, delta 텍스트가 도착할 때마다 onChunk로 전달한다.
 * 첫 콘텐츠 청크를 받기 전에 실패하면 err.stage = 'pre' (다음 순위로 폴백 가능),
 * 이미 청크를 하나라도 보낸 뒤 실패하면 err.stage = 'mid' (폴백 불가, 사용자에게 에러 안내).
 */
async function streamOpenRouter(model, systemPrompt, prompt, controller, onChunk) {
  let idleTimer;
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  };
  resetIdleTimer();

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (err) {
    clearTimeout(idleTimer);
    const wrapped = new Error(err.message);
    wrapped.stage = 'pre';
    throw wrapped;
  }

  if (!response.ok) {
    const errText = await response.text();
    clearTimeout(idleTimer);
    const wrapped = new Error(`HTTP ${response.status}: ${errText}`);
    wrapped.stage = 'pre';
    throw wrapped;
  }

  const decoder = new StringDecoder('utf8');
  let buffer = '';
  let receivedAnyContent = false;

  try {
    for await (const chunk of response.body) {
      resetIdleTimer();
      buffer += decoder.write(chunk);
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 미완성 줄은 다음 chunk와 합치기 위해 버퍼에 남김

      for (const line of lines) {
        const trimmed = line.trim();
        // OpenRouter는 연결 유지를 위해 ":" 로 시작하는 주석 라인을 보내기도 함
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          clearTimeout(idleTimer);
          return { receivedAnyContent };
        }

        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) {
            receivedAnyContent = true;
            onChunk(delta);
          }
        } catch {
          // 조각난 JSON 라인은 복구 불가하므로 무시
        }
      }
    }
  } catch (err) {
    clearTimeout(idleTimer);
    const wrapped = new Error(err.message);
    wrapped.stage = receivedAnyContent ? 'mid' : 'pre';
    throw wrapped;
  }

  clearTimeout(idleTimer);
  return { receivedAnyContent };
}

app.post('/api/evaluate', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: true, message: 'prompt 값이 필요합니다.' });
  }

  let models;
  let systemPrompt;
  try {
    models = loadModels();
    systemPrompt = loadSystemPrompt();
  } catch (err) {
    console.error('설정 파일을 불러오지 못했습니다:', err.message);
    return res.status(500).json({
      error: true,
      message: '지금은 평가 기능을 사용할 수 없어요. 잠시 후 다시 시도해주세요.',
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.socket?.setNoDelay(true);
  res.on('error', () => {}); // 클라이언트 연결 종료 후 write 시 발생하는 에러 무시

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let clientDisconnected = false;
  let activeController = null;
  // req의 'close'는 요청 바디를 다 읽기만 해도 발생할 수 있어 신뢰할 수 없다.
  // res의 'close'가 writableEnded=false 상태로 발생하면 실제로 연결이 끊긴 것이다.
  res.on('close', () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
      activeController?.abort();
    }
  });

  for (let i = 0; i < models.length; i++) {
    if (clientDisconnected) return;

    const model = models[i];
    const rank = i + 1;
    console.log(`${rank}순위 모델(${model}) 시도 중...`);

    const controller = new AbortController();
    activeController = controller;

    try {
      await streamOpenRouter(model, systemPrompt, prompt, controller, (delta) => {
        sendEvent('chunk', { text: delta });
      });
      console.log(`${rank}순위 모델(${model}) 성공`);
      activeController = null;
      if (!clientDisconnected) {
        sendEvent('done', { model });
        res.end();
      }
      return;
    } catch (err) {
      if (err.stage === 'mid') {
        console.error(`${rank}순위(${model}) 스트리밍 도중 오류: ${err.message}`);
        activeController = null;
        if (!clientDisconnected) {
          sendEvent('error', { message: '응답 중 오류가 발생했습니다. 다시 시도해주세요.' });
          res.end();
        }
        return;
      }
      console.error(`${rank}순위 실패 (${model}): ${err.message}`);
      if (rank < models.length) {
        console.log(`${rank}순위 실패, ${rank + 1}순위로 전환`);
      }
    }
  }

  activeController = null;
  console.error('모든 모델 시도 실패');
  if (!clientDisconnected) {
    sendEvent('error', { message: '지금은 평가 기능을 사용할 수 없어요. 잠시 후 다시 시도해주세요.' });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Prompt Archive server running at http://localhost:${PORT}`);
});
