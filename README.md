# 오이붕 코퍼레이션

친구들이 만든 웹게임을 모아 놓은 사이트. 게임 목록과 평가, 스크린샷은 누구나 볼 수 있다. 초대된 계정은 사이트에서 게임 링크를 등록하고 각 게임의 상세 화면에 스크린샷과 후기를 올릴 수 있다. 별점과 후기는 게임당 계정 하나에 한 건이며 다시 저장하면 수정된다.

## Supabase 연결

1. Supabase 프로젝트에서 Data API와 이메일·비밀번호 로그인을 활성화한다. SQL Editor에서 [공유 기능 마이그레이션](supabase/migrations/20261112000000_community.sql)을 한 번 실행한다. 이미 CLI로 프로젝트를 관리 중이면 같은 파일을 `supabase db push`로 적용할 수 있다. 초기 게임 4개와 이미지 버킷, 실시간 구독용 테이블이 생성된다.
2. `community-config.js`에 프로젝트 API URL과 **Publishable key**를 입력한다. 이전 프로젝트에서는 공개용 **anon** 키도 사용할 수 있다. 서버용 Secret이나 Service Role 키는 브라우저 파일에 넣지 않는다.
3. Supabase의 Authentication → Users에서 참가자별 계정을 만든다. 이메일/비밀번호로 로그인할 수 있는 확정된 계정이어야 한다. Users에서 복사한 사용자 UUID를 넣어 SQL Editor에서 등록 권한을 준다. 신규 가입을 끄고 운영자가 계정을 직접 생성해도 된다.

   ```sql
   insert into public.oc_members (user_id)
   values ('사용자 UUID'::uuid)
   on conflict do nothing;
   ```

4. 친구는 사이트 하단의 **게임 등록하기**에서 로그인한다. **게임 등록하고 상세 열기**를 누르면 해당 상세 화면에 이미지 업로드와 평가 폼이 나온다. 기존 게임도 **게임 자세히 보기**에서 참여할 수 있다.

이미지는 JPG·PNG·WebP, 파일당 최대 5MB다. 저장된 이미지와 닉네임, 별점, 후기는 공개 페이지에 표시된다. 이메일은 공개 목록에 표시되지 않는다.

## GitHub Pages 배포

1. GitHub에 `oibung-corporation` 저장소를 만들고 이 폴더의 파일을 저장소 최상단에 커밋한다.
2. 저장소의 **Settings → Pages → Build and deployment**에서 **Deploy from a branch → main → /(root)**를 선택한다.
3. Pages에 표시된 배포 주소를 두 개의 브라우저 세션에서 연다. 초대 계정으로 게임을 등록하고, 상세에 이미지와 평가를 추가한다. 다른 창에서 새로고침 없이 반영되는지 확인한다. 같은 게임에서 평가를 다시 저장하고 평가 수가 그대로인지 확인한다.

## 로컬 실행

```sh
python3 -m http.server 8000
```

`http://localhost:8000`에서 연다. Supabase 설정 전에도 초기 게임 목록과 검색, 찜을 확인할 수 있다. 찜은 브라우저에 저장된다.
