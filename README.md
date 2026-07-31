# 프롬프트 보관함

자주 쓰는 프롬프트를 저장/관리하고, OpenRouter API로 AI 평가까지 받을 수 있는 로컬 웹앱입니다.

## 최초 1회 설정

1. 패키지 설치

   ```
   npm install
   ```

2. `.env` 파일에 OpenRouter API 키 입력

   `.env.example`을 참고해서 `.env` 파일을 만들고(이미 있다면 값만 채우고), `OPENROUTER_API_KEY`에 발급받은 키를 입력하세요.

   ```
   OPENROUTER_API_KEY=여기에_키_입력
   PORT=3000
   ```

   키는 https://openrouter.ai/settings/keys 에서 발급받을 수 있습니다.

## 이후 사용법

`start.bat` 파일을 더블클릭하세요.

- 서버(`server.js`)가 백그라운드에서 자동으로 실행되고,
- 잠시 후 기본 브라우저로 `http://localhost:3000` (또는 `.env`에 지정한 `PORT`)이 자동으로 열립니다.
- 이미 서버가 켜져 있는 상태에서 다시 실행해도 오류 없이 브라우저만 다시 열립니다 (중복 실행 방지).

서버를 끄고 싶다면 작업 관리자에서 `node.exe` 프로세스를 종료하면 됩니다.

수동으로 실행하고 싶다면:

```
npm start
```

## AI 평가에 사용할 모델 우선순위 바꾸기

`config/models.json`에 우선순위대로 모델 ID가 배열로 저장되어 있습니다.

```json
[
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free"
]
```

- 서버는 1순위 모델부터 순서대로 시도하고, 실패(에러/타임아웃/rate limit)하면 자동으로 다음 순위로 넘어갑니다.
- 사용 가능한 모델 목록과 최신 무료 모델은 https://openrouter.ai/models 에서 확인할 수 있습니다.
- 이 파일을 수정한 뒤 서버를 재시작할 필요 없이, 다음 평가 요청부터 바로 새 우선순위가 적용됩니다.

AI 평가 시스템 프롬프트(평가 규칙)는 `config/systemPrompt.txt`에서 수정할 수 있습니다.
