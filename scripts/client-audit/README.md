# 보관 클라이언트 원본 감사

Node.js의 내장 `node:sqlite`와 Python 3 표준 라이브러리를 사용한다. 원본, 기존 정규화 파일, 게임 프로세스 및 서버를 수정하지 않는다. 게임 코드를 실행하거나 새 파일을 다운로드하지 않는다. 원본 문자열·전체 행·SQLite·해시 원장은 **저장소 밖 비공개 디렉터리**에만 출력한다. 기존 감사 결과를 덮어쓰지 말고 실행별 새 경로를 지정한다.

## 원본 선택 계약

`source.cjs`의 `createSource(corpus).table(name)`은 `selected-source-manifest.json`을 위치 안내로 사용하고, 캡처된 `BinVersionList_Realtime.json` 자체의 SHA, 원본 CFG의 SHA/MD5/크기, 헤더 개수, 실제 스키마를 다시 검증한다. 정규화 JSON로 대체하는 fallback은 없다. `parse(name)`은 스트리밍 가능한 reader를 반환한다.

스키마가 없는 분할 파일은 같은 파일명 계열의 실제 embedded CFG에서 유일한 스키마를 재읽어 적용한다. 기존 manifest의 `rootClass:null`은 미해석 헤더 정보이며 실제 클래스가 null이라는 뜻이 아니다. 새 index 항목이 manifest에 없으면 실패한다. 알려진 운영 설정 3개(`account_delete_config`, `account_migration_jp`, `user_behavior_type`)와 디렉터리 인덱스 2개는 선택 게임 모델에서 명시적으로 제외하지만, 전수 파일/CFG 감사에는 기록한다. 새로운 제외 항목은 검토 없이 추가하지 않는다.

## 실행 순서

아래 `<corpus>`, `<review>`는 실제 비공개 경로로 바꾼다. `<review>/cfg` 등의 출력은 존재하지 않는 새 경로여야 한다.

```powershell
python -B scripts/client-audit/inventory.py --corpus "<corpus>" --workspace "<workspace>" --output "<review>/files"
python -B scripts/client-audit/audit_apks.py --corpus "<corpus>" --output "<review>/apks.json"
python -B scripts/client-audit/audit_pack.py --corpus "<corpus>" --output "<review>/pack.json"
node scripts/client-audit/audit_cfg.cjs --corpus "<corpus>" --output "<review>/cfg"
node scripts/client-audit/compare_cached_rows.cjs --corpus "<corpus>" --audit "<review>/cfg" --output "<review>/cache-comparison.json"
python -B scripts/client-audit/summarize.py --corpus "<corpus>" --audit "<review>/cfg" --repo . --output "<review>/tables.json"
node scripts/client-audit/domain_examples.cjs --corpus "<corpus>" --output "<review>/domain-examples.json"
python -B scripts/client-audit/compare.py --before "<previous-review>/cfg" --after "<review>/cfg" --output "<review>/changes.json"
```

첫 스냅샷은 `--before`를 생략한다. 신규/삭제/변경 class+ID가 있으면 diff는 `REVIEW_NEW_DATA`와 exit2를 반환한다. 변경 파일·레코드·언어·이미지·출시 근거를 검토한 뒤에만 결과의 정확한 `changeSHA256`을 `--ack-change-sha`로 전달한다. 이 인수는 구조적 오류를 무시하지 않는다. 다른 스냅샷과의 diff는 시간순·출시순을 자동으로 증명하지 않는다.

선택된 typed 참조의 고아, 파싱 실패, 정규화 차이, 같은 class+ID의 상충 값은 구조 gate를 실패시킨다. 정수 map key, 문자열 ID, EId, nonzero reference tag는 별도의 도메인 의미 검증이 필요하며 고아 0만으로 안전하다고 판단하지 않는다. `scripts/build-hero-pet-relations.js`의 검증된 소비 계약과 이미지 연결 검사는 이 범용 검사 다음에 별도로 실행한다. 새 영웅·펫이 diff에 나오더라도 출시는 자동 승인하지 않는다.

## 언어·Lua 원본 대조

`audit_languages.py`는 `--decoder`로 지정한 **검토된 로컬 data-only Python 파서**를 import한다. 보관 APK metadata에서 필요한 값을 메모리로 읽고 원본 언어 암호문을 다시 해석한다. 암호문/바이너리 round-trip과 기존 JSON 정확 일치를 확인하며 키 및 전체 원문을 출력하지 않는다. 임의 파일을 decoder로 지정하지 않는다.

```powershell
python -B scripts/client-audit/audit_languages.py --corpus "<corpus>" --decoder "<reviewed-tools>/decode_languages.py" --inventory-db "<review>/files/inventory.sqlite" --output "<review>/languages.json"
python -B scripts/client-audit/verify_textassets.py --index "<corpus>/integration-41/unity/priority-lua/textassets-index.jsonl" --snapshot-root "<corpus>/integration-41/snapshot/blobs" --output "<review>/lua.json" --names PetSkillMainConfigEx.lua PetModule.lua PetFormationProxy.lua
```

Lua 검사는 독립적인 bounded UnityFS/LZ4/TextAsset 바이트 판독이다. pathID→offset은 기존 object index를 위치 안내로 쓰고, 원본 bundle/CAB/object/name/script 해시를 재검증한다. Lua 실행·현재 런타임 선택을 검증하는 도구는 아니다. 언어 로딩 사전만 있는 언어를 전체 인게임 번역 확보로 계산하지 않는다.

## 테스트

```powershell
node --test scripts/client-audit/test_source.cjs
python -B scripts/client-audit/test_audit.py
```

합성 fixture만으로 source 변경 거절, 새 index 누락 차단, null-metadata fragment, 원본/공개 경로 보호, 신규·변경·삭제 diff, 동일 ID의 클래스 구분, 중복 행, 상충 값, 고아 참조, LZ4 및 TextAsset 경계 실패를 확인한다. 원본 기반 전수 검사 결과와 합성 도구 테스트의 통과 수를 혼동하지 않는다.

## 해석 한계

- 파일 수에는 원본·분할 패키지·추출물·정규화 복사본이 섞여 있다. SHA·class+ID·선택 cohort를 각각 구분한다.
- `summarize.py`의 public JSON provenance와 build-code literal scan은 사용 근거다. 참조 미검출은 미사용 확정이 아니다. 동적 접근과 수작업으로 작성한 HTML 전체를 추적한 결과가 아니다.
- type4의 8바이트는 보존하며 signedLE64는 후보일 뿐이다. 전체 필드에 임의 단위나 게임 공식을 부여하지 않는다.
- 보관 자료 밖의 새 APK, 서버 상태, 미확보 파일의 분모는 알 수 없다. 전체 게임 추출률/완전 해석률을 만들지 않는다.
- 이 도구는 원본 감사 도구다. 사이트 release gate, 21개 언어·URL·UI 회귀, 운영 확인을 대체하지 않는다.
