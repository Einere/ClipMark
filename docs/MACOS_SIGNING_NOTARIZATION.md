# macOS Signing and Notarization Guide

이 문서는 GitHub Actions에서 ClipMark macOS 배포 산출물을 서명하고 공증하기 위해 필요한 Apple/GitHub secrets 준비 절차를 정리한다.

현재 릴리스 워크플로는 `.github/workflows/release.yml`에서 다음 흐름으로 동작한다.

1. macOS runner에서 Apple Developer ID 인증서를 임시 키체인에 설치한다.
2. 설치된 인증서 중 `Developer ID Application` identity를 찾아 `APPLE_SIGNING_IDENTITY`로 설정한다.
3. Tauri 빌드에 Apple ID 공증 자격 증명을 전달한다.
4. Tauri가 hardened runtime으로 앱을 서명하고 Apple notary service에 제출한다.

## 필요한 GitHub Secrets

| Secret | 필수 여부 | 값 | 준비 방법 |
| --- | --- | --- | --- |
| `APPLE_CERTIFICATE` | 필수 | `Developer ID Application` 인증서를 포함한 `.p12` 파일의 base64 문자열 | Keychain Access에서 `.p12`로 내보낸 뒤 base64 인코딩 |
| `APPLE_CERTIFICATE_PASSWORD` | 필수 | `.p12` 파일을 내보낼 때 지정한 암호 | `.p12` export 과정에서 직접 설정 |
| `APPLE_ID` | 필수 | Apple Developer 계정 이메일 | Apple Developer Program에 가입된 Apple Account |
| `APPLE_TEAM_ID` | 필수 | 10자리 Team ID | Apple Developer 계정의 Membership details에서 확인 |
| `APPLE_PASSWORD` | 둘 중 하나 필수 | Apple Account app-specific password | `account.apple.com`에서 생성 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 둘 중 하나 필수 | `APPLE_PASSWORD`와 같은 app-specific password | 참고 repo와 호환하기 위한 별칭 |

`APPLE_PASSWORD`와 `APPLE_APP_SPECIFIC_PASSWORD`가 둘 다 있으면 현재 워크플로는 `APPLE_PASSWORD`를 우선 사용한다.

`KEYCHAIN_PASSWORD`는 필요하지 않다. 워크플로가 매 실행마다 임시 키체인 암호를 무작위로 생성한다.

## 1. Developer ID Application 인증서 준비

Gatekeeper를 통과하는 직접 배포용 앱은 개발용 인증서가 아니라 `Developer ID Application` 인증서로 서명해야 한다. `Apple Development`, `Mac Development`, `Mac Distribution`, ad-hoc 서명은 이 용도에 맞지 않는다.

### Xcode로 생성하는 방법

1. Xcode를 연다.
2. `Xcode > Settings > Accounts`로 이동한다.
3. Apple Developer 계정을 추가하거나 선택한다.
4. 팀을 선택하고 `Manage Certificates...`를 연다.
5. `+` 버튼을 눌러 `Developer ID Application` 인증서를 생성한다.
6. Keychain Access에서 생성된 인증서를 확인한다.

### Apple Developer 웹에서 생성하는 방법

1. `https://developer.apple.com/account/resources/certificates/list`로 이동한다.
2. `Certificates, Identifiers & Profiles > Certificates`에서 `+`를 누른다.
3. `Developer ID Application`을 선택한다.
4. macOS Keychain Access에서 Certificate Signing Request를 만든다.
   - `Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority...`
   - 이메일과 이름을 입력한다.
   - `Saved to disk`를 선택해 CSR 파일을 저장한다.
5. Developer 웹에 CSR을 업로드한다.
6. 생성된 `.cer` 파일을 다운로드하고 더블 클릭해 Keychain에 추가한다.

## 2. 인증서를 `.p12`로 내보내기

1. macOS `Keychain Access`를 연다.
2. `login` 키체인에서 `Developer ID Application: ... (TEAMID)` 인증서를 찾는다.
3. 인증서 왼쪽의 펼침 화살표를 열어 private key가 함께 있는지 확인한다.
4. 인증서와 private key가 포함되도록 항목을 선택한다.
5. `File > Export Items...`를 선택한다.
6. 파일 형식을 `Personal Information Exchange (.p12)`로 저장한다.
7. export password를 입력한다. 이 값이 `APPLE_CERTIFICATE_PASSWORD`가 된다.

private key가 없는 `.cer`만으로는 CI에서 서명할 수 없다. 반드시 private key가 포함된 `.p12`를 만들어야 한다.

## 3. `.p12`를 base64로 인코딩

macOS에서 다음 명령을 실행한다.

```sh
base64 -i DeveloperIDApplication.p12 | tr -d '\n' | pbcopy
```

클립보드에 들어간 값을 GitHub secret `APPLE_CERTIFICATE`에 붙여 넣는다.

파일로 저장하고 싶다면 다음처럼 만든다.

```sh
base64 -i DeveloperIDApplication.p12 | tr -d '\n' > apple-certificate.base64.txt
```

인코딩이 정상인지 확인하려면 임시 파일로 다시 디코딩해 본다.

```sh
base64 --decode -i apple-certificate.base64.txt -o /tmp/DeveloperIDApplication.p12
```

확인 후 임시 파일과 base64 텍스트 파일은 삭제한다. 인증서와 private key가 들어 있으므로 저장소에 커밋하면 안 된다.

## 4. App-specific password 생성

Apple notary service에 Apple ID 방식으로 인증하려면 일반 Apple Account 암호가 아니라 app-specific password를 사용한다.

1. `https://account.apple.com`에 로그인한다.
2. `Sign-In and Security`로 이동한다.
3. `App-Specific Passwords`를 연다.
4. 이름을 `ClipMark Notarization`처럼 알아보기 쉽게 입력한다.
5. 생성된 password를 복사한다.
6. GitHub secret `APPLE_PASSWORD`에 저장한다.

Apple Account는 two-factor authentication이 켜져 있어야 app-specific password를 만들 수 있다. Apple Account 기본 암호를 변경하거나 재설정하면 기존 app-specific password가 폐기될 수 있으므로, 이후 릴리스 실패 시 이 값을 먼저 확인한다.

참고 repo와 secret 이름을 맞추고 싶다면 같은 값을 `APPLE_APP_SPECIFIC_PASSWORD`로 저장해도 된다. ClipMark 워크플로는 두 이름을 모두 허용한다.

## 5. Team ID 확인

`APPLE_TEAM_ID`는 Apple Developer Program 팀의 10자리 식별자다.

확인 방법:

1. `https://developer.apple.com/account`에 로그인한다.
2. `Membership details` 또는 계정 멤버십 화면으로 이동한다.
3. `Team ID` 값을 복사한다.

로컬 키체인에 Developer ID 인증서가 있다면 다음 명령 출력에서도 괄호 안 Team ID를 확인할 수 있다.

```sh
security find-identity -v -p codesigning | grep "Developer ID Application"
```

예시:

```text
Developer ID Application: Example Corp (ABCDE12345)
```

이 경우 `ABCDE12345`가 `APPLE_TEAM_ID`다.

## 6. GitHub에 secrets 등록

GitHub 웹 UI:

1. GitHub 저장소로 이동한다.
2. `Settings > Secrets and variables > Actions`를 연다.
3. `New repository secret`을 눌러 필요한 secrets를 추가한다.

GitHub CLI를 사용하는 경우:

```sh
gh secret set APPLE_CERTIFICATE --body "$(base64 -i DeveloperIDApplication.p12 | tr -d '\n')"
gh secret set APPLE_CERTIFICATE_PASSWORD
gh secret set APPLE_ID
gh secret set APPLE_TEAM_ID
gh secret set APPLE_PASSWORD
```

`gh secret set NAME`만 실행하면 터미널에서 값을 입력할 수 있다. shell history에 민감한 값이 남지 않도록 password류 secret은 대화형 입력을 권장한다.

## 7. 릴리스 실행 전 체크리스트

- Apple Developer Program 멤버십이 활성 상태다.
- `APPLE_CERTIFICATE`는 `Developer ID Application` 인증서와 private key가 포함된 `.p12`를 base64 인코딩한 값이다.
- `APPLE_CERTIFICATE_PASSWORD`는 `.p12` export password와 일치한다.
- `APPLE_ID`는 해당 Team에 접근 가능한 Apple Developer 계정이다.
- `APPLE_PASSWORD` 또는 `APPLE_APP_SPECIFIC_PASSWORD`는 app-specific password다.
- `APPLE_TEAM_ID`는 인증서의 Team ID와 같은 팀이다.
- `.github/workflows/release.yml`의 macOS job이 `Developer ID Application` identity를 찾을 수 있어야 한다.

## 8. 배포 산출물 검증

릴리스가 끝난 뒤 macOS 산출물을 내려받아 다음을 확인한다.

앱 번들 서명 확인:

```sh
codesign -dvvv --entitlements :- "ClipMark.app"
```

Gatekeeper 평가:

```sh
spctl -a -vv "ClipMark.app"
```

DMG 또는 앱에 notarization ticket이 붙었는지 확인:

```sh
xcrun stapler validate "ClipMark.app"
xcrun stapler validate "ClipMark_0.1.1_aarch64.dmg"
```

`spctl` 출력에 accepted가 나오고, source가 `Notarized Developer ID` 또는 Developer ID 계열로 표시되면 Gatekeeper 관점에서 배포 가능한 상태다.

## 9. 자주 나는 오류

### `No Developer ID Application certificate found`

`APPLE_CERTIFICATE`에 개발용 인증서나 Mac App Store용 인증서가 들어간 경우다. `Developer ID Application` 인증서를 다시 만들고 `.p12`로 export한다.

### `The specified item could not be found in the keychain`

`.p12`에 private key가 포함되지 않았거나 export가 잘못된 경우다. Keychain Access에서 인증서 하위에 private key가 보이는 상태로 다시 export한다.

### Notarization authentication failure

`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` 중 하나가 잘못된 경우가 많다.

- app-specific password를 새로 생성한다.
- Apple Account가 해당 Team에 속해 있는지 확인한다.
- Team ID가 인증서의 Team ID와 같은지 확인한다.

### Gatekeeper가 여전히 차단함

다음을 확인한다.

- 서명 identity가 `Developer ID Application`인지 확인한다.
- hardened runtime이 켜져 있는지 확인한다.
- notarization ticket stapling이 완료됐는지 확인한다.
- DMG를 배포한다면 DMG 자체도 공증됐는지 확인한다.

## 참고 문서

- Tauri v2 macOS code signing: `https://v2.tauri.app/distribute/sign/macos`
- Apple Developer ID: `https://developer.apple.com/developer-id/`
- Apple notarization overview: `https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution`
- Apple app-specific passwords: `https://support.apple.com/102654`
