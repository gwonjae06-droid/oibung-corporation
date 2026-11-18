# 공유 세계 시작

Windows에서 Node.js 20 이상을 설치한 뒤 이 폴더의 **start.cmd**를 더블클릭한다. 로컬 플레이는 첫 질문에서 Enter를 누른다. 마을이 브라우저에서 열리며 서버 창이 열린 동안 계속 진행된다. 다른 운영체제에서는 이 폴더에서 `node launch.mjs`를 실행한다.

## 친구 및 카카오 채널 연결

1. 외부에서 접속할 HTTPS 주소를 단일 Node 서버에 연결하고 영구 저장 공간을 준비한다. localhost 주소는 같은 컴퓨터에서 사용한다.
2. `node launch.mjs --setup`에서 공개 주소와 카카오 채널 주소를 입력한다. 생성된 비밀값과 설정은 사용자 홈의 .oibung-village 폴더에 보관된다.
3. 콘솔에 나온 비공개 스킬 URL을 카카오 챗봇 관리자에 등록해 폴백 또는 해당 명령 블록에 연결하고 챗봇을 채널에 배포한다. 친구에게는 공개 서버 주소만 보낸다.
4. 동일한 카카오 앱에 카카오 로그인을 활성화하고, Redirect URI를 공개 서버의 /connect/kakao/callback 으로 등록한다. 서버 환경 변수 KAKAO_REST_KEY, KAKAO_REDIRECT_URI 및 앱에서 사용하는 KAKAO_CLIENT_SECRET을 설정한다. 채널 봇도 같은 앱을 연결하고 계정 연동 동의 후 스킬 요청에 user.properties.appUserId가 전달되도록 설정한다.
5. 친구는 공유 세계의 ‘카카오톡 연결’을 누른다. 카카오 인증과 필요한 동의를 마치면 성좌에 연동된 채널 채팅으로 자동 이동한다.

호스팅에서 직접 실행할 때는 `node server.mjs`와 PORT, WORLD_FILE, KAKAO_SECRET, KAKAO_CHANNEL_URL 환경 변수를 사용한다. /health 는 서버 상태 확인 주소다. 기존 world-save.json이 있으면 시작 도우미도 그 저장을 이어간다.