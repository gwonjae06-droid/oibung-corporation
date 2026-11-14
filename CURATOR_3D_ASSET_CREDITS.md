# 3D 전시관 비서 모델 자산 출처

현재 오이붕 갤러리의 1인칭 전시관은 도형을 조합한 이전 비서 메시 대신, VRoid Studio의 스킨드 메시(얼굴·몸·헤어·의상 모델링 및 휴머노이드 본)를 불러옵니다.

- 3D 모델: **おんなのこ１ロング (Anime Girl / VRoid Studio sample)** — VRoid Project / pixiv Inc.
- 공개 재배포 출처: https://github.com/GY19A/jev-stage/blob/main/static/vrm/anime_girl.vrm
- 웹 모델 파일: https://gy19a.github.io/jev-stage/static/vrm/anime_girl.vrm
- 라이선스: **CC0 1.0** (원 출처 프로젝트의 확인 및 VRoid 공식 샘플 안내에 따름).
- 공식 VRoid 샘플 라이선스 안내: https://vroid.pixiv.help/hc/en-us/articles/4402614652569
- 3D 런타임: Three.js 및 @pixiv/three-vrm (MIT 라이선스).

이 파일은 **실제 스킨·텍스처가 있는 외부 VRM 자산**입니다. 사용자가 제공한 금발/검정 민소매 의상 참고 이미지를 그대로 복제한 독점 모델이 아닙니다. 웹사이트는 금발 계열 염색과 어두운 의상 색조를 적용하지만, 옷의 실제 실루엣·헤어스타일·얼굴 비율이 참고 이미지와 정확히 일치한다고 주장하지 않습니다.

모델은 프로젝트 내부에 포함하지 않고 외부 웹 파일에서 가져옵니다. 따라서 원 출처 호스팅 및 CDN 가용성에 의존하며, 다운로드가 실패하는 경우 기존 일러스트가 나타납니다. 장기적으로 자체 제작한 GLB/VRM을 같은 로더에 연결하면 교체할 수 있습니다.

성능: VRM 기반 모델은 원본 데이터를 한 번 로드하고, 복제된 리그가 버텍스 데이터를 공유합니다. 작품 주변에 있을 때만 렌더링/애니메이션 처리하도록 설계했습니다.
