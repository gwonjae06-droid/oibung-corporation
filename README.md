# 오이붕 코퍼레이션

친구들이 만든 웹게임을 모아 놓은 사이트. 게임 목록과 평가, 스크린샷은 누구나 볼 수 있다. 방문자는 로그인 없이 사이트에서 게임 링크를 등록하고 각 게임의 상세 화면에 스크린샷과 후기를 올릴 수 있다. 별점과 후기는 게임당 브라우저 하나에 한 건이며 다시 저장하면 수정된다.

## 게임 등록과 평가

사이트 하단의 **게임 등록하기**에서 게임을 등록한다. 등록한 게임이나 기존 게임의 **게임 자세히 보기**에서 스크린샷과 평가를 올릴 수 있다. 한 브라우저에서 같은 게임의 평가를 다시 저장하면 이전 평가가 수정된다. 스크린샷은 JPG·PNG·WebP로 파일당 5MB까지 올릴 수 있다. 공개 글에는 등록 한도가 적용된다.

## Supabase 연결

`supabase/migrations`의 SQL을 순서대로 적용하고 `oibung-guest` Edge Function을 배포한다. 이 함수는 공개 방문자 요청을 받으며 게스트 키, 입력값, 등록 한도를 자체 검증한다. 허용된 출처는 함수의 `origin`에 설정한다.

```sh
supabase functions deploy oibung-guest --no-verify-jwt
```

`community-config.js`에는 프로젝트 URL과 브라우저용 Publishable key를 입력한다. 서비스 역할 키는 Edge Function 런타임에서만 사용한다.

## GitHub Pages 배포

1. GitHub에 `oibung-corporation` 저장소를 만들고 이 폴더의 파일을 저장소 최상단에 커밋한다.
2. 저장소의 **Settings → Pages → Build and deployment**에서 **Deploy from a branch → main → /(root)**를 선택한다.
3. Pages에 표시된 배포 주소를 두 개의 브라우저 세션에서 연다. 게임을 등록하고, 상세에 이미지와 평가를 추가한다. 다른 창에서 새로고침 없이 반영되는지 확인한다. 같은 게임에서 평가를 다시 저장하고 평가 수가 그대로인지 확인한다.

## 로컬 실행

```sh
python3 -m http.server 8000
```

`http://localhost:8000`에서 연다. Supabase 설정 전에도 초기 게임 목록과 검색, 찜을 확인할 수 있다. 찜은 브라우저에 저장된다.
