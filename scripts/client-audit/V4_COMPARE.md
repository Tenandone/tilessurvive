# V4 비교 manifest

`v4-compare.cjs`는 기존 원본 감사 결과를 비교 가능한 **비공개 manifest**로 내보내고 두 코호트의 차이를 분류한다. 기존 원본 추출기나 정규화 fallback을 대체하지 않는다. 원본과 공개 데이터는 읽기 전용이며 출력은 저장소 및 원본 코호트 밖 새 경로로 지정한다.

```powershell
node scripts/client-audit/v4-compare.cjs --snapshot --audit "<review>/cfg-final" --corpus "<retained-corpus>" --language-audit "<review>/inventory-language-redecode.json" --images "<review>/image-index-v4.json" --output "<new-review>/manifest.json"
node scripts/client-audit/v4-compare.cjs --before "<old-review>/manifest.json" --after "<new-review>/manifest.json" --output "<new-review>/changes.json"
node --test scripts/client-audit/test_v4_compare.cjs
```

새 클라이언트가 적법하게 확보되면 기존 `audit_cfg.cjs` 등으로 원본을 먼저 파싱·검증한다. `--audit`의 SQLite는 그 결과여야 한다. 전체 class+ID와 값 SHA, 테이블·스키마·원본 SHA를 보존하며 hero/NPC 후보인 `Survivor`, `PetBase` 변경을 별도 집계한다. 스킬·버프·효과·조건 클래스의 수치 및 `Param/Formula` 문자열은 원본 감사값과 SHA가 일치하는 캐시만 읽는다. 8바이트 값은 원래 rawHex를 유지하며 임의 숫자·단위로 바꾸지 않는다.

typed 관계와 정수/문자열 관계 후보는 따로 비교한다. 후보는 확정 외래키나 조합 추천이 아니다. 언어 파일은 성공한 재해석 원장의 JSON SHA와 일치해야 한다. 이미지 입력 형식은 다음과 같으며 이 범위 설명이 다르면 양쪽을 직접 비교하지 않는다.

```json
{"schemaVersion":1,"scope":"정확히 어떤 이미지 인덱스를 포함했는지 설명","images":[{"id":"resource-name","fingerprint":"SHA256 64자리"}]}
```

fingerprint는 안정된 논리 리소스 ID에 대응하는 원본 객체/이미지 해시 목록의 digest다. 기기별 절대 경로를 fingerprint에 넣지 않는다. 현재 V4 manifest는 특정 게임플레이 리소스 389개 이름의 보관 decoded object index 범위다. 원본 이미지 전체나 상용 사용 허가를 검증했다는 뜻이 아니다. 언어·이미지 입력을 제공하지 않으면 해당 범위는 `INCOMPLETE`로 남으며, 그 부재를 삭제로 계산하지 않는다.

결과 상태:

- `BLOCKED`: 원본 파싱/정규화/동일ID 충돌/typed 고아 검증 실패. exit2.
- `INCOMPLETE`: 언어·이미지 비교 범위 누락 또는 서로 다른 범위. exit2.
- `REVIEW_REQUIRED`: 신규·삭제·변경 또는 버전/manifest 변경. exit2. 검토 없이 공개 모델을 갱신하지 않는다.
- `NO_CONTENT_CHANGE`: 선언한 비교 범위 내 차이 없음. exit0. 최신 클라이언트 확보·출시 확인·실전 검증을 뜻하지 않는다.

원본을 새로 받지 않은 동일 코호트 self-check를 실제 버전 업데이트 비교로 보고하지 않는다. 새 영웅·펫 후보, 누락된 언어키·리소스, 스킬 수치 변경을 검토한 후 기존 사이트 release gate·21언어·브라우저 회귀를 별도로 통과해야 한다. 이 도구는 자동 배포를 승인하지 않는다. 전체 레코드·언어 key digest 때문에 manifest 크기가 클 수 있으므로 공개 저장소에 포함하지 않는다.
