# V6 기술 선정 근거

2026-11-05에 공식 문서, npm 게시 메타데이터, GitHub 저장소의 최근 push·archive 여부를 확인했다. 현재 저장소는 21개 언어의 정적 HTML 생성기와 바닐라 JavaScript를 사용한다. 이번 선택은 **Lucide 선택 SVG, Embla 8.6.0, Intl, 기본 CSS 효과, WebP 이미지**다. 실제 모션은 CSS의 hover·focus 상태와 감소된 모션 설정, Embla의 이동 처리로 구성했다. Web Animations API는 후보로만 평가했으며 `Element.animate()`를 직접 사용하지 않는다. React 기반으로 전체 사이트를 전환하지 않는다.

다음 표의 도입 비용·채택 여부는 이 저장소에 대한 판단이다. 라이브러리가 제공하는 기능을 실제 사이트에서 검증 완료했다는 뜻은 아니다. 기능·접근성·모바일 사용성은 별도 테스트와 브라우저 확인을 거쳐야 한다.

## 후보 비교

| 후보 · 확인한 안정판 | 라이선스 | 정적 사이트 적용·모바일·접근성 | 비용 / 결정 |
| --- | --- | --- | --- |
| [Tailwind CSS 4.3.4](https://tailwindcss.com/docs/installation/using-vite) | MIT | 빌드한 CSS는 호환된다. 반응형 스타일은 편하지만 의미 있는 HTML·포커스 동작은 앱 책임이다. 기존 CSS 전환 범위가 크다. | 높음 / 기존 CSS 체계 유지 |
| [shadcn/ui · CLI 4.23.0](https://ui.shadcn.com/docs) | MIT | 컴포넌트 코드 배포 방식이다. 현재 HTML 빌더에 단일 스크립트로 붙이는 제품이 아니며 선택 컴포넌트의 기반 UI·프레임워크 연결이 필요하다. | 높음 / 전면 도입 보류 |
| [Radix Primitives · Dialog 1.3.1](https://www.radix-ui.com/primitives/docs/overview/introduction) | MIT | React primitives가 ARIA·포커스·키보드 구현을 돕는다. React 연결과 모바일 스타일은 별도 작업이다. | 높음 / 보류 |
| [Lucide 1.68.0](https://lucide.dev/license) | ISC + 일부 Feather 아이콘 MIT | 선택 SVG를 정적으로 삽입한다. 장식 아이콘은 숨기고 의미 있는 버튼에는 현지어 이름을 붙인다. | 낮음 / 채택 |
| [Motion 14.9.1](https://motion.dev/docs/quick-start) | MIT | React 없이 바닐라 JS로도 사용 가능하다. 스프링·복합 동작에 유용하지만 현재 짧은 UI 효과에는 기본 API로 충분하다. 감소된 모션 처리가 필요하다. | 중간 / 복합 효과가 필요할 때 재검토 |
| [GSAP 3.15.1](https://gsap.com/community/standard-license/) | 별도 Standard No Charge 라이선스 | 바닐라 JS와 호환된다. 복잡한 타임라인에 강하지만 현재 홈에는 추가 비용이 크다. 읽기 순서·포커스·감소된 모션은 검증해야 한다. | 중간 / 보류 |
| [CSS View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) | 브라우저 API, 별도 런타임 배포 없음 | 선택적인 페이지·DOM 전환에 사용한다. 지원되지 않으면 기본 탐색을 유지하고 기능을 막지 않는다. | 낮음~중간 / 점진적 향상 후보 |
| [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) | 브라우저 API | 짧은 transform·opacity 효과를 기존 DOM에 적용할 수 있다. 감소된 모션 설정을 존중하고 불필요한 점멸을 피해야 한다. 현재 V6는 이 API를 직접 호출하지 않는다. | 낮음 / 후보 평가만; 실제 효과는 CSS·Embla |
| [Embla Carousel 8.6.0](https://www.embla-carousel.com/docs/v8) | MIT | 프레임워크·외부 의존성 없이 기존 카드 HTML을 초기화한다. 스와이프와 이전·다음 버튼, RTL, 키보드 포커스를 함께 확인한다. | 낮음~중간 / 가이드 캐러셀에 채택 |
| [Swiper 14.4.0](https://swiperjs.com/get-started) | MIT | 바닐라 모듈·script·웹컴포넌트 방식이 있다. 다양한 효과에 유용하나 모듈·CSS·A11y·Keyboard 구성을 선택해야 한다. | 중간 / 고급 갤러리 요구 시 후보 |
| [Apache ECharts 6.1.0](https://echarts.apache.org/handbook/en/best-practices/aria/) | Apache-2.0 | Canvas·SVG 차트에 적합하다. 접근성 설명은 명시적으로 AriaComponent를 가져와 활성화해야 하며 원본 표도 필요하다. 단순 목표 막대에는 과하다. | 중간~높음 / 심층 분석 페이지에서 재검토 |
| [TanStack Table Core 9.3.1](https://tanstack.com/table/latest/docs/overview) | MIT | headless 표 엔진이다. 마크업·반응형 배치·키보드·정렬 상태 이름을 직접 구현해야 한다. | 중간~높음 / 복잡한 비교표 요구 전까지 보류 |
| [date-fns 4.4.0](https://github.com/date-fns/date-fns) | MIT | 필요한 날짜 함수를 선택할 수 있다. 현재 UTC 기한과 단순 카운트다운에는 추가 의존성이 필요하지 않다. | 낮음~중간 / 복잡한 달력 연산 때 후보 |
| [Luxon 3.7.2](https://github.com/moment/luxon) | MIT | Intl 기반 시간대·기간 연산에 유용하다. 여러 IANA 시간대의 DST 반복 일정이 필요할 때 가치가 커진다. | 낮음~중간 / 현재 보류 |
| [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) | ECMAScript 내장 API | 21개 언어의 날짜·숫자 표시를 담당한다. 원본 UTC 시각과 표시 시간대를 분리한다. | 낮음 / 채택 |
| [Fuse.js 7.5.0](https://github.com/krisk/Fuse/blob/main/LICENSE) | 현재 Apache-2.0 | 의존성 없는 오타 허용 검색이다. 검색 결과 키보드·상태 안내는 앱 책임이다. 현재 작은 영웅 목록의 정확 검색에는 추가 필요성이 낮다. | 낮음~중간 / 통합 공략 검색 확장 시 후보 |
| [WebP](https://developers.google.com/speed/webp) | 이미지 형식; 인코더와 원본 그림의 권리는 별도 | 정적 img·picture로 사용한다. 크기별 파일, width·height, 적절한 alt를 제공하고 작은 게임 글자·선의 품질을 확인한다. | 낮음 / 신규 행사 그림에 채택 |
| [AVIF](https://github.com/AOMediaCodec/libavif) | 형식 자체와 도구 구분; libavif BSD-2-Clause | picture에 WebP 대체 파일과 함께 제공할 수 있다. 이미지별 용량·시각 품질·디코드 비용을 비교한다. | 낮음~중간 / 실제 이득 확인 후 선택 |

npm 안정판 게시일과 GitHub 최근 push는 유지보수 활동의 관측값이다. 보안 감사나 장기 지원 보증으로 해석하지 않는다. 조사한 13개 npm 후보의 GitHub 저장소는 확인 당시 archive 상태가 아니었다. 특히 Embla는 안정판 게시일이 2025-04-04이지만 저장소에는 2026-11-01 활동이 확인됐으며, 공식 기본 문서는 9.0.0-rc04를 안내한다. 안정판 코드에는 [8.x 문서](https://www.embla-carousel.com/docs/v8)를 사용하고 9.x API를 섞지 않는다.

## 배포 파일 크기 측정

아래 값은 2026-11-05에 **공식 npm tarball에 들어 있는 지정된 배포 파일**을 읽어 측정했다. 내려받은 코드는 실행하지 않았다. gzip은 레벨 9·mtime 0 조건이다. CSS, 다른 의존성, 애플리케이션 연결 코드, 폰트는 포함하지 않는다. 필요한 모듈만 묶은 실제 앱 번들 크기와 다르므로 표의 전체 파일끼리만 비교한다.

| 패키지 | 측정 파일 | 원본 바이트 | gzip 바이트 |
| --- | --- | ---: | ---: |
| Embla 8.6.0 | `embla-carousel.umd.js` | 17,946 | 7,156 |
| Swiper 14.4.0 | `swiper-bundle.min.js` | 154,826 | 44,372 |
| GSAP 3.15.1 | `dist/gsap.min.js` | 73,357 | 28,448 |
| ECharts 6.1.0 | `dist/echarts.min.js` | 1,121,883 | 368,202 |
| date-fns 4.4.0 | `cdn.min.js` | 90,180 | 20,858 |
| Luxon 3.7.2 | `build/global/luxon.min.js` | 81,694 | 24,238 |
| Fuse.js 7.5.0 | `dist/fuse.min.mjs` | 26,095 | 9,182 |

원본은 npm의 해당 버전 배포물이다. 예를 들어 [Embla 8.6.0 tarball](https://registry.npmjs.org/embla-carousel/-/embla-carousel-8.6.0.tgz)과 [Swiper 14.4.0 tarball](https://registry.npmjs.org/swiper/-/swiper-14.4.0.tgz)을 사용했다. gzip 응답 크기는 서버 설정에 따라 달라질 수 있다.

Motion 공식 시작 문서는 mini `animate()`를 3.2kb라고 안내하지만, 이 수치를 전체 Motion 또는 이번 조사에서 직접 측정한 gzip 크기로 표시하지 않는다. Tailwind의 생성 CSS, 선택한 Radix·shadcn·TanStack 컴포넌트의 실제 앱 번들은 측정하지 않았으므로 미확인이다. npm의 `unpackedSize`는 브라우저 전송량이 아니다.

선택 SVG, Intl, 기본 애니메이션 API, WebP·AVIF에는 별도 클라이언트 라이브러리 다운로드가 필요하지 않는다. SVG·이미지 파일 자체와 사이트 연결 코드는 여전히 전송되므로 전체 비용을 0바이트로 표현하지 않는다. 이미지 압축 이득은 각 이미지로 측정하며 일반적인 포맷 비교율을 이 사이트의 절감률로 옮기지 않는다.

## 실제 적용 위치와 고지

- Embla 코드는 [`js/vendor/embla-carousel-8.6.0.js`](../js/vendor/embla-carousel-8.6.0.js), 고지는 [`licenses/embla-carousel-MIT.txt`](../licenses/embla-carousel-MIT.txt)에 있다. 홈 초기화는 [`js/v5-landing.js`](../js/v5-landing.js)가 담당한다.
- Lucide 선택 SVG는 `img/ui/lucide/`에 있다. [`licenses/lucide-ISC.txt`](../licenses/lucide-ISC.txt)에 ISC와 Feather 유래 아이콘의 MIT 고지를 모두 보존한다. 의미 없는 장식은 `aria-hidden`, 아이콘 버튼은 현지어 접근성 이름을 사용한다.
- 행사 시각은 [`js/common-events.js`](../js/common-events.js)의 UTC 원본·epoch 계산과 Intl 표시를 사용한다. 사용자가 선택한 UTC 오프셋을 확인된 게임 서버 시간대로 단정하지 않는다.
- GSAP의 현재 라이선스는 일반 웹사이트·앱 사용을 무상으로 허용하지만 Webflow와 경쟁하는 무코드 시각 애니메이션 빌더 용도에는 제한이 있다. 이를 MIT·Apache 라이선스로 표기하지 않는다.
- Fuse의 현재 7.5.0 라이선스는 Apache-2.0이다. 예전 버전의 라이선스 기억을 새 버전에 적용하지 않는다.

## 검증 기준

캐러셀은 자동 재생 없이 스와이프와 버튼으로 이동하도록 구성하고, 키보드 포커스·양끝 버튼 상태·RTL·감소된 모션·초기화 실패 시 카드 접근을 확인한다. 카운트다운 갱신은 기존 링크 노드를 재생성하지 않아야 한다. 표·차트·검색은 데이터 정확성과 키보드 접근을 시각 효과보다 먼저 확인한다.

라이브러리 버전을 바꿀 때에는 버전·라이선스·배포 파일 해시·실측 크기를 다시 기록한다. 현재 문서는 기술 선정과 측정의 근거이며, 운영 배포나 모든 대상 기기의 브라우저 검증 완료를 주장하지 않는다. 행사 데이터의 검토·21개 언어 반영·빌드·배포 순서는 [공통 이벤트 운영 절차](common-events-runbook.ko.md)를 따른다.
