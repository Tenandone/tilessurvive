# GA4 운영 계측

운영자의 2026-11-06 변경 지시에 따라 GA4와 Google Search Console만 사용한다. 별도 수집 서버, 데이터베이스, 방문자 ID 또는 자체 관리 대시보드는 없다.

## 기존 누락 원인

`166b1c964d70ca11688c290d6f7bc0f563a11912`(2026-11-04 20:29:11 KST)에서 이전의 즉시 GA 초기화가 opt-in 초기화로 바뀌었다. `tiles.v3.analyticsConsent`가 `granted`일 때만 Google 라이브러리, 설정과 `page_view`가 실행되었다. 미선택과 거절 모두 전송이 없었다. 이는 코드에서 확인한 수집 공백이며 감소 전체를 이 변경 하나로 설명하는 인과 추정과는 구분한다.

쿠폰 전용 페이지의 성공 복사는 홈에서만 허용된 `trackLanding`으로 전달되어 누락되었고, 여러 계산기와 플래너에는 성공 계측 훅이 없었다. 원자력 가이드도 일반 콘텐츠로 분류되었다.

## 공통 동작

- 확인된 속성: `532946839`, 웹 스트림: `14368655633`, 측정 ID: `G-Z2MJ6TXZHK`.
- `js/analytics-contract.js`가 21언어, 페이지 분류, 공개 콘텐츠 slug와 허용 이벤트 매개변수를 정의한다.
- `js/v3-affiliate.js`가 유일한 Google 로더와 `page_view` 소유자다. `send_page_view:false` 뒤 명시적으로 문서당 한 번 전송한다. 새로고침은 새 문서 조회다.
- 예전 동의 키 하나만 삭제한다. 그 값을 읽어서 새 상태를 정하지 않으며 도구 저장 데이터는 정리하지 않는다.
- Google의 analytics/ad storage, ad user data, ad personalization은 `denied`로 초기화한다. 코드가 `granted`로 바꾸지 않는다. Google Signals와 광고 개인화 신호를 사용하지 않는다.
- 개인정보 페이지의 전송 중지 선택은 `tiles.analytics.objection.v1`에만 저장한다. 이는 방문자 식별자나 쿠키 허용 동의가 아니다. 재개해도 Google 동의 상태는 `denied`다.
- GPC/DNT, 자동화 브라우저, `?analytics_test=1`, 개발 호스트에서는 전송하지 않는다. 저장소를 읽을 수 없을 때도 전송을 시작하지 않는다.
- 쿼리/해시를 제외한 게시자 canonical URL과 일반화된 페이지 제목을 보낸다. 원본 유입 URL, 검색어, 입력값, 쿠폰 원문, 사용자 ID, 임의 매개변수는 보내지 않는다. 유입은 다섯 가지 범주만 사용한다.
- 실패한 계산·복사는 집계하지 않는다. 초기 렌더, 저장 상태 자동 복구와 단순 키 입력을 계산 실행으로 세지 않는다. 통계 호출 오류가 도구나 이동을 막지 않도록 분리한다.
- 광고 코드와 광고 동의/CMP를 보존한다. 통계 전송 중지 기능은 광고 동의를 변경하지 않는다.

## 이벤트와 보고서

| 이벤트 | 의미 |
| --- | --- |
| `page_view` | 페이지 조회, 공개 콘텐츠 분류/ID |
| `calculator_run` | 유효한 사용자 계산 실행 |
| `planner_use` | 계획 저장·복원·공유 등 성공한 동작 |
| `coupon_copy` | 쿠폰 복사 성공 |
| `content_action` | 도감 등의 주요 동작 |
| `lootbar_outbound_click` | TEN 목적지로 이동한 클릭 |
| `affiliate_viewable` | 60% 이상 1초 표시된 안내 |
| `topup_guide_open`, `topup_guide_view` | 충전 안내 이동·조회 |
| `landing_view`, `landing_use`, `ten_program_use` | 기존 랜딩/TEN 의미 유지 |

TEN 목적지는 `https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive`다. 클릭과 노출은 구매·매출이 아니다.

GA4 이벤트 범위 맞춤 정의: `site_language`, `page_type`, `content_id`, `feature`, `action`, `placement`, `ten_placement`, `measurement_version`, `source_category`. `site_language`는 브라우저 언어와 별개로 열람한 페이지 언어를 나타낸다. 새 구현은 `measurement_version=global-1`이다.

운영자는 GA4 **보고서 → 페이지 및 화면 / 이벤트 / 실시간**, **탐색**에서 이벤트 수·조회수를 확인한다. 콘텐츠 순위에는 `page_type`과 `content_id`, TEN 분석에는 이벤트 이름과 `placement`/`ten_placement`를 사용한다. 국가 정보는 Google의 기본 국가 측정기준을 사용한다. 맞춤 정의는 등록 이후 처리된 데이터에 적용되며 처리 지연과 임계값이 존재한다.

## 계정 측 검증

Google의 향상된 측정은 원본 링크·검색·폼을 자동 수집할 수 있으므로 이 구현의 수동 허용 목록과 함께 사용할 수 없다. 2026-11-06 운영 웹 스트림에서 향상된 측정을 중지했다. 변경 전 페이지 조회·스크롤·이탈 클릭·사이트 검색·양식 상호작용·동영상·파일 다운로드가 모두 켜져 있었으며 설정 화면을 비공개 작업 기록에 보존했다. 수동 page_view와 허용 이벤트는 사이트 코드가 전송한다. 계정 설정 변경은 코드 롤백과 별개다.

쿠키 없는 ping은 전송 중단이나 완전한 익명화를 뜻하지 않는다. Google의 처리 방식, 브라우저 차단, 모델링 자격과 처리 지연에 따라 보고서에 공백이 있을 수 있다. 개별 사용자를 추적하지 않는다는 이유로 정확한 순방문자를 계산했다고 주장하지 않는다. 과거 누락을 임의로 채우지 않는다.

**운영자가 수용한 보고서 제한:** 2026-11-06 실제 속성의 보고 ID 화면은 혼합됨으로 설정되어 있지만 “이 속성에는 모델링을 사용할 수 없습니다”로 표시됐다. Google은 모델을 만들 충분한 동의 트래픽이 없으면 거절 상태의 이벤트를 보고서에 표시하지 않는다고 설명한다. 운영자는 이 사실을 확인한 뒤 “동의 UI 완전 제거 유지 — GA4 보고서 집계 제한 수용”을 선택했다. 이 버전은 쿠키 없는 신호의 전송 경로를 복구하지만 조회·클릭 보고서 정상화를 보장하지 않는다. 실시간 보고서나 DebugView에 표시되지 않는 신호를 수신된 보고서 숫자로 주장하지 않는다. [Google 모델링 조건](https://support.google.com/analytics/answer/11161109?hl=en), [DebugView의 동의 제한](https://support.google.com/analytics/answer/7201382?hl=en).

Search Console의 기존 소유권, 사이트맵, 검증 파일·태그는 변경하지 않는다. 검색 클릭과 사이트 페이지 조회를 합산하지 않는다.

## 개발·검증·복구

1. `npm run test:analytics`로 데이터 최소화, 구 허용/거절/미선택 마이그레이션, 전송 중지/재개, 중복과 오류 격리를 확인한다.
2. `npm run build`와 사이트 회귀 검사를 실행한다. 개인정보 페이지는 `scripts/build-analytics-privacy.js`가 같은 데이터에서 21언어를 생성한다.
3. PC·모바일·RTL을 `?analytics_test=1`로 확인해 운영 통계에 테스트를 섞지 않는다.
4. 실제 전송 확인은 범위를 제한하고 실제 GA4 수신과 별도 기록한다. 네트워크 전송 성공만으로 보고서 정상화를 선언하지 않는다.
5. PR 병합 후 Pages 게시와 운영 파일을 비교한다. 문제가 생기면 해당 병합을 일반 `git revert -m 1 <merge-sha>` PR로 되돌린다. 강제 푸시하지 않는다.
6. 맞춤 정의는 과거 통계를 삭제하지 않는다. 롤백 시 새 정의를 삭제할 필요가 없다. 향상된 측정 등 계정 변경은 별도 보존 기록에 따라 복구 여부를 판단한다.

공개 문의 주소는 운영자가 지정한 `ant79798@gmail.com`이다. 21언어 방침은 `data/analytics-privacy-copy.json`에서 관리한다.
