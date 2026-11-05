# 공통 이벤트 주간 운영 절차

기준일: 2026-11-05. 작성 시 확인한 브랜치는 `codex/v51-events-20261105`다. 이 문서는 현재 저장소의 명령과 운영 절차를 설명한다. 운영 배포, 원격 워크플로 등록, 예약 실행이 완료됐다는 보고서는 아니다.

## 관리 파일

| 역할 | 파일 |
| --- | --- |
| 공통 행사·쿠폰 사실 | [`data/common-events.json`](../data/common-events.json) |
| 21개 언어 표시 문구 | [`data/v51-event-copy.json`](../data/v51-event-copy.json) |
| 지원 언어 목록 | [`data/i18n/locales.json`](../data/i18n/locales.json) |
| 행사 선택·기간·쿠폰 판정 | [`js/common-events.js`](../js/common-events.js) |
| 행사 HTML 생성 | [`scripts/common-event-content.js`](../scripts/common-event-content.js) |
| 홈 생성 및 브라우저 갱신 | [`scripts/build-v5-landing.js`](../scripts/build-v5-landing.js), [`js/v5-landing.js`](../js/v5-landing.js) |
| 공식 자료 변경 검사 | [`scripts/check-common-events.js`](../scripts/check-common-events.js) |
| 검토 기준 해시 | [`.github/common-events-baseline.json`](../.github/common-events-baseline.json) |
| 주간 검사 정의 | [`.github/workflows/common-events-review.yml`](../.github/workflows/common-events-review.yml) |

파일명에 V5·V5.1이 남아 있어도 현재 V6 홈이 사용하는 공통 모듈이다. 같은 사실을 언어별 HTML에서 따로 수정하지 않는다.

## 매주 월요일 검사

워크플로 이름은 **Review official common events**다. 예약식 `17 0 * * 1`은 월요일 **00:17 UTC / 09:17 Asia/Seoul**을 뜻한다. GitHub 예약 실행은 기본 브랜치의 워크플로와 저장소 Actions 설정을 따르며 지연될 수 있다. 파일을 작성한 것만으로 실제 예약 실행을 확인한 것은 아니다.

검사는 공식 행사 HTML, 그 페이지가 참조한 같은 출처의 공개 JavaScript, 공식 홈페이지, 공식 뉴스 목록을 읽는다. X 전체 타임라인, 로그인한 계정, 개인 UID, 게임 우편·구매 기록은 검사하지 않는다. 새로운 SNS 공지는 별도로 공식 원문을 확인한다.

수동 실행은 GitHub Actions의 해당 워크플로에서 **Run workflow**를 사용한다. CLI를 쓸 경우 다음 명령은 해당 브랜치가 원격에 반영된 뒤에만 유효하다.

```sh
gh workflow run common-events-review.yml --ref codex/v51-events-20261105
gh run list --workflow common-events-review.yml --limit 5
```

브랜치가 변경되면 `--ref`도 실제 원격 브랜치로 바꾼다. 실행 결과의 artifact는 `common-events-review-실행ID`이며 보관 기간은 30일이다. 워크플로는 `contents: read` 권한만 사용하고 소스 수정, 커밋, 푸시, 배포를 하지 않는다.

로컬 PowerShell에서는 저장소 루트에서 다음과 같이 실행한다. 보고서 디렉터리는 저장소 밖에 있어야 하고 파일명은 매번 달라야 한다.

```powershell
npm ci --ignore-scripts
$reviewDirectory = Join-Path (Split-Path -Parent (Get-Location).Path) 'common-event-reviews'
New-Item -ItemType Directory -Force -Path $reviewDirectory | Out-Null
$reviewReport = Join-Path $reviewDirectory ('review-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
node scripts/check-common-events.js --baseline .github/common-events-baseline.json --output $reviewReport
```

기준 파일 없이 첫 관측 보고서만 만들려면 `--baseline`을 생략한다. 기본 제한은 요청당 15초·응답당 5MiB다. 필요하면 `--timeout-ms 15000 --max-bytes 5242880`처럼 명시할 수 있다. 허용 HTTPS 출처·경로와 리디렉션을 검사하며, 내려받은 JavaScript는 실행하지 않는다. 원문은 메모리에서 정규화해 해시를 계산하고 보고서에는 요약 사실·기사 링크·해시를 저장한다.

| 결과 | 해석과 후속 조치 |
| --- | --- |
| `baseline-created` | 비교 기준 없는 첫 관측. 검토 후에만 새 기준으로 채택한다. |
| `unchanged` | 이번에 읽은 소스의 의미 해시가 기준과 같다. 모든 공식 채널에 신규 공지가 없다는 뜻은 아니다. |
| `changed` | 신규 소스, 본문 변경, 신규·제거 기사 후보를 원문과 비교한다. 자동으로 행사 사실을 확정하지 않는다. |
| `needs-review` | 접근 실패·시간 초과·추출 실패 등이 있다. 프로세스 종료 코드 2이며 정상 무변경으로 취급하지 않는다. |

CLI 인자·출력 경로 등의 오류는 종료 코드 1이다. 개별 문제는 `changes.accessFailures`, 변경 후보는 `contentChanged`, `newArticles`, `removedArticles`, `newSources`에 기록된다. 뉴스 페이지에 접근하지 못했을 때 기사 삭제를 추정하지 않는다.

## 후보를 공개 정보로 반영하는 순서

1. **변경 후보만 수집한다.** artifact 또는 외부 보고서를 보존한다. 실패한 소스가 있으면 해당 내용을 미확인으로 남긴다.
2. **공식 사실을 검토한다.** 행사명, 시작·종료와 시간대, 참가 범위, 무료·선택 구매 조건, 과제 반복·초기화, 전용 재화, 보상, 수령·메일 조건, 참여 링크를 공식 원문에서 확인한다. 제목이나 공유 카드의 “진행 중”만으로 기간을 확정하지 않는다.
3. **공통 데이터를 수정한다.** 확인한 사실을 `data/common-events.json`의 공통 ID에 반영한다. `sources`의 URL·확인 시각·해시와 해시 종류를 보존한다. 원시 응답 해시와 저장한 공개 게시물 추출본 해시를 혼동하지 않는다.
4. **21개 언어를 동기화한다.** `data/v51-event-copy.json`에 같은 행사 ID의 표시 문구를 추가한다. 공식 현지명이 확인되지 않으면 설명 또는 영어 고유명을 사용한다. 수치·기간·지급 조건은 공통 JSON에서 가져온다.
5. **검사·빌드·화면 검증을 수행한다.** 아래 현재 명령을 사용한다. 기존 SEO, 광고, TEN 링크, 영웅·펫·편성·계산 데이터의 보존을 함께 확인한다.
6. **검토한 기준과 배포 변경을 함께 기록한다.** 검토가 끝난 경우에만 `.github/common-events-baseline.json`의 해당 소스 해시·기사 목록을 갱신한다. 전체 보고서나 공식 규칙 전문을 기준 파일에 복사하지 않는다.
7. **검증된 커밋을 기존 운영 배포 경로로 반영한다.** 배포 커밋, 이전 정상 커밋, 운영 URL, 검증 시각을 남긴다. Actions의 조사 artifact 생성과 사이트 배포는 별개다.

확인하지 못한 날짜, 게임 수치, 출시 상태, 서버 조건을 추정으로 채우지 않는다. 접근 실패가 발생해도 기존 종료 시간을 연장하거나 미확인 행사를 자동 게시하지 않는다.

## 검사와 빌드 명령

현재 `package.json`의 V6 명령은 다음과 같다.

```sh
npm run test:v6
node --test scripts/test-v6-generators.js
npm run test:xssr
npm run test:v4
npm run test:hero-atlas
npm run test:community
npm run build:release:check
npm run build
npm run build:release:check
npm run test:v6
```

변경 범위에 따라 관련 검사를 선택하되, 운영 릴리스에는 전체 보존 게이트를 통과해야 한다. `npm run build`는 `scripts/build-client-release.js --apply`를 실행한다. 이 파이프라인은 현재 소유 모듈로 페이지를 생성하고, 저장소 밖 `client-release-artifacts`에 전후 기록과 백업을 남기며, 실패하면 이번 실행에서 백업한 파일을 복원한다. 성공 결과도 `deployed: false`다.

홈과 공통 시각 체계만 확인하는 별도 명령은 `npm run build:v6`다. 이는 `build-v5-landing.js`와 `build-v6-system.js`를 실행하며 운영 배포를 하지 않는다. 과거 `build:legacy`나 `build:historical-full`을 V6 릴리스의 대체 명령으로 사용하지 않는다.

PC와 390px 모바일에서 현재 행사·다음 일정·점수 행동·동맹 대결 준비·영웅 검색·추천 펫·성장 계산·쿠폰 복사·충전 안내를 실제 브라우저로 확인한다. AR/RTL, 키보드 포커스, 캐러셀 버튼, 감소된 모션 설정도 확인한다. 브라우저를 사용할 수 없는 검사는 “미확인”으로 남기며 HTTP 응답을 UI 성공으로 기록하지 않는다.

## 기간 종료와 쿠폰 처리

`js/common-events.js`는 `시작 ≤ 현재 < 종료`인 검증 행사를 진행 중으로 선택한다. 진행 중 행사가 없으면 가장 가까운 예정 행사를 고르고, 둘 다 없으면 뉴스 화면으로 전환한다. 종료된 행사 일정과 쿠폰은 브라우저 갱신 때 숨긴다. 종료 후에는 행사 참여·카운트다운·상세 패널을 계속 진행 중으로 남기지 않는다.

할로윈 공식 종료 표기는 **2026-11-08 23:59 UTC**로 분 단위다. 데이터는 `endsAt: 2026-11-08T23:59:00Z`, `endPrecision: minute`, `endPolicy: stop-at-start-of-official-end-minute`를 사용한다. 이는 표시된 마지막 분의 시작에서 종료하는 보수적 처리이며, 확인되지 않은 초 단위를 공식 사실로 주장하거나 다음 날 00:00 UTC까지 연장하지 않는다. KST 표시는 **11월 9일 08:59**다.

현재 쿠폰 판정은 공식 발표와 유효기간을 기준으로 한다. `redemptionTested: false`인 코드를 실제 계정에서 교환 성공한 것처럼 표현하지 않는다. 공식 본문 일부가 잘려 시간대까지 확인할 수 없으면 공개 활성 코드로 추가하지 않는다. 종료 fallback과 기한 직전·정각·직후는 고정 시각 테스트로 검증한다.

## 게임 클라이언트와 H5 이벤트의 구분

게임 클라이언트 **2.6.300 / build 1531**은 영웅·스킬·성장·장비 등 확인한 게임 설정의 근거다. H5 웹 이벤트는 공식 웹 규칙과 별도 일정에 근거한다. 클라이언트에 영웅이나 행사 설정이 존재한다는 이유로 모든 서버에 출시·개방됐다고 판단하지 않는다.

잭 오 랜턴 웹 이벤트의 점등 횟수·공동 목표를 게임 내부 할로윈 제작 재화나 점수에 합산하지 않는다. 공식 상점 방문 미션은 행사 페이지의 링크 조건을 따른다. TEN/LootBar 충전이 “매일 첫 게임 내 현금 구매” 미션을 충족한다고 추정하지 않는다.

## 이미지와 라이선스

공식 페이지에서 열리거나 공유 미리보기에 사용되는 이미지라는 사실만으로 일반 재게시 권한이 확인된 것은 아니다. 권리 근거가 없으면 공식 이미지를 복제하지 않고, 별도 제작한 행사 그림과 공개 사실을 조합한다. 자체 제작 그림을 실제 게임 스크린샷이나 공식 행사 아트로 표시하지 않는다. 게임 초상화·아이콘의 기존 출처·검증 기록은 별도로 유지한다.

UI 아이콘과 라이브러리는 [`licenses/lucide-ISC.txt`](../licenses/lucide-ISC.txt), [`licenses/embla-carousel-MIT.txt`](../licenses/embla-carousel-MIT.txt)의 고지를 함께 배포한다. Lucide 파일에는 Feather 유래 아이콘의 MIT 고지도 포함된다. 이미지 최적화 시 원본을 보존하고 파생 파일의 치수·품질·용량을 검증한다.

## 배포 후 확인과 롤백

운영 URL에서 새 행사·기한·공식 참여 링크·이미지·21개 언어를 확인한 뒤에만 배포 성공을 기록한다. 코드가 저장되거나 빌드가 통과했다는 사실은 운영 반영 증거가 아니다.

롤백은 이전 정상 커밋 또는 현재 호스팅의 이전 정상 배포를 기준으로 수행한다. 공유 브랜치에서는 배포 변경 커밋을 `git revert 배포커밋SHA`로 되돌려 새 커밋으로 배포하는 방식을 우선한다. 여러 커밋이 한 릴리스이면 해당 변경 범위를 먼저 확인한다. 빌드의 로컬 자동 복원은 이미 올라간 운영 배포를 되돌리는 기능이 아니다.
