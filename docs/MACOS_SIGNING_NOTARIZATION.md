# macOS Signing and Notarization Guide

ClipMark의 macOS 릴리스 산출물이 Gatekeeper에 차단되지 않도록 GitHub Actions에 Developer ID 서명과 Apple 공증을 붙이는 절차다.

이 문서는 ClipMark 전용 절차다. `tomato-mien`은 참고할 수 있는 이전 사례일 뿐이며, 앱 이름, bundle identifier, 버전, 릴리스 workflow, 산출물 경로는 ClipMark 기준으로 새로 확인해야 한다.

ClipMark는 Tauri v2 앱이고, `tomato-mien`은 Electron 앱이다. 따라서 `tomato-mien`의 `electron-builder`, `electron/notarize.js`, Electron entitlements, MAS 설정은 이 프로젝트에 복사하지 않는다. ClipMark는 이미 `.github/workflows/release.yml`에서 `tauri-apps/tauri-action`을 사용하므로 Tauri 방식으로 서명/공증을 설정한다.

## 1. 현재 상태 확인

먼저 ClipMark의 앱 메타데이터를 확인한다.

```sh
node -p "require('./src-tauri/tauri.conf.json').productName"
node -p "require('./src-tauri/tauri.conf.json').identifier"
```

현재 기준:

```text
productName: ClipMark
identifier: com.einere.clipmark
```

`identifier`는 macOS 앱의 bundle identifier로 쓰인다. `tomato-mien`의 `com.tomato-mien.app` 같은 값을 재사용하지 않는다.

다음으로 프로젝트 버전을 확인한다.

```sh
node -p "require('./package.json').version"
node -p "require('./src-tauri/tauri.conf.json').version"
```

현재 확인 시점에는 ClipMark의 `package.json`은 `0.1.1`, `src-tauri/tauri.conf.json`은 `0.1.0`이다. 릴리스 태그를 만들기 전에 `npm run release:prepare -- <version>`으로 버전 bump 커밋과 태그를 먼저 만든다.

```json
{
  "version": "0.1.1"
}
```

CI는 버전 파일을 자동 수정하지 않는다. 대신 태그 버전과 `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json` 버전이 다르면 release workflow를 실패시킨다.

## 2. ClipMark용 릴리스 기준 정하기

서명/공증 자체는 개발자 계정의 `Developer ID Application` 인증서로 수행한다. 인증서는 앱마다 새로 만들 필요는 없고 같은 개발자 계정의 Developer ID 인증서를 여러 앱에 사용할 수 있다.

하지만 아래 항목은 ClipMark 기준이어야 한다.

- GitHub repository secrets는 ClipMark 저장소에 등록한다.
- GitHub Release 이름은 `ClipMark vX.Y.Z` 형식을 사용한다.
- bundle identifier는 `com.einere.clipmark`를 사용한다.
- 검증 대상 앱 경로는 `ClipMark.app`이다.
- Electron 전용 `APPLE_APP_SPECIFIC_PASSWORD` 이름은 사용하지 않고, Tauri용 `APPLE_PASSWORD`를 사용한다.

## 3. Apple Developer 준비물 만들기

Apple Developer 계정이 필요하다.

준비해야 할 값은 다음과 같다.

- `Developer ID Application` 인증서
- 인증서를 `.p12`로 내보낼 때 지정한 비밀번호
- Apple ID 이메일
- Apple ID 앱 전용 비밀번호
- Apple Team ID

Apple Developer 웹에서 `Certificates, Identifiers & Profiles`로 이동한 뒤 `Developer ID Application` 인증서를 만든다. 로컬 Mac의 Keychain Access에 인증서와 private key가 들어온 상태여야 한다.

인증서가 로컬에 보이는지 확인한다.

```sh
security find-identity -v -p codesigning
```

결과에 다음과 비슷한 identity가 있어야 한다.

```text
Developer ID Application: <Developer Name> (<TEAM_ID>)
```

## 4. 인증서를 p12로 export

Keychain Access에서 `Developer ID Application` 인증서와 private key를 함께 선택한 뒤 `.p12`로 export한다.

권장 파일명은 ClipMark임을 알아볼 수 있게 정한다.

```text
clipmark-developer-id-application.p12
```

export 비밀번호는 이후 GitHub secret `APPLE_CERTIFICATE_PASSWORD`에 넣는다.

## 5. p12를 base64로 변환

GitHub secret에는 바이너리 파일을 직접 넣을 수 없으므로 base64 문자열로 변환한다.

macOS:

```sh
base64 -i clipmark-developer-id-application.p12 | pbcopy
```

출력값을 복사해서 `APPLE_CERTIFICATE` secret으로 저장한다.

## 6. 앱 전용 비밀번호 생성

Apple ID 계정 설정에서 App-Specific Password를 만든다.

GitHub secret 이름은 Tauri 기준으로 `APPLE_PASSWORD`를 사용한다. ClipMark에서는 Electron 프로젝트에서 쓰던 `APPLE_APP_SPECIFIC_PASSWORD` 이름을 쓰지 않는다.

## 7. GitHub Secrets 추가

GitHub 저장소에서 `Settings > Secrets and variables > Actions > New repository secret`으로 이동해 다음을 추가한다.

| Secret | 값 |
| --- | --- |
| `APPLE_CERTIFICATE` | `.p12` 파일을 base64로 변환한 문자열 |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` export 비밀번호 |
| `APPLE_ID` | Apple ID 이메일 |
| `APPLE_PASSWORD` | Apple ID 앱 전용 비밀번호 |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

`APPLE_TEAM_ID`는 Apple Developer 멤버십 페이지에서 확인할 수 있다.

## 8. 릴리스 버전 준비 스크립트 사용

릴리스 전에는 로컬에서 버전 bump 커밋과 태그를 먼저 만든다.

```sh
npm run release:prepare -- 0.1.2
```

이 스크립트는 다음을 수행한다.

- 작업 트리가 깨끗한지 확인한다.
- `0.1.2` 또는 `v0.1.2` 같은 SemVer 입력을 검증한다.
- `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`의 `version`을 같은 값으로 갱신한다.
- `chore(release): v0.1.2` 커밋을 만든다.
- `v0.1.2` 태그를 만든다.
- push 명령을 출력한다.

스크립트가 끝나면 출력된 명령으로 브랜치와 태그를 함께 푸시한다.

```sh
git push origin HEAD v0.1.2
```

## 9. release.yml에 버전 검증 단계 추가

`.github/workflows/release.yml`에서 `Install frontend dependencies` 다음, 인증서 import 이전에 릴리스 버전을 검증한다.

태그 기반 실행이면 `github.ref_name`을 사용하고, 수동 실행이면 `inputs.tag_name`을 사용한다. CI는 파일을 수정하지 않고, 태그 버전과 파일 버전이 다르면 실패한다.

```yaml
      - name: Verify release version
        env:
          TAG_NAME: ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
        run: |
          VERSION="${TAG_NAME#v}"
          if ! node -e "process.exit(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(process.argv[1]) ? 0 : 1)" "$VERSION"; then
            echo "::error::Release tag must look like v1.2.3, v1.2.3-beta.1, or v1.2.3+build.1. Received: $TAG_NAME"
            exit 1
          fi

          node - "$VERSION" <<'NODE'
          const expectedVersion = process.argv[2];
          const pkg = require("./package.json");
          const lock = require("./package-lock.json");
          const tauri = require("./src-tauri/tauri.conf.json");
          const actual = {
            "package.json": pkg.version,
            "package-lock.json": lock.version,
            "package-lock.json packages[\"\"]": lock.packages?.[""]?.version,
            "src-tauri/tauri.conf.json": tauri.version,
          };
          const mismatches = Object.entries(actual).filter(([, version]) => version !== expectedVersion);

          if (mismatches.length > 0) {
            console.error(`Release tag version is ${expectedVersion}, but version files do not match:`);
            for (const [path, version] of mismatches) {
              console.error(`- ${path}: ${version ?? "(missing)"}`);
            }
            console.error("Run `npm run release:prepare -- " + expectedVersion + "` before creating the release tag.");
            process.exit(1);
          }

          console.log(`Release version verified: ${expectedVersion}`);
          NODE
```

## 10. release.yml에 인증서 import 단계 추가

`.github/workflows/release.yml`에서 `Install frontend dependencies` 다음, `Build and upload release assets` 이전에 아래 단계를 추가한다.

```yaml
      - name: Install Apple certificate
        if: startsWith(matrix.platform, 'macos')
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)

          echo -n "$APPLE_CERTIFICATE" | base64 --decode -o "$CERTIFICATE_PATH"

          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security import "$CERTIFICATE_PATH" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security list-keychain -d user -s "$KEYCHAIN_PATH"

          CERT_ID=$(security find-identity -v -p codesigning "$KEYCHAIN_PATH" | grep "Developer ID Application" | head -1 | awk -F'"' '{print $2}')
          if [ -z "$CERT_ID" ]; then
            echo "::error::Developer ID Application certificate was not found in the temporary keychain."
            security find-identity -v -p codesigning "$KEYCHAIN_PATH"
            exit 1
          fi

          echo "APPLE_SIGNING_IDENTITY=$CERT_ID" >> "$GITHUB_ENV"
          echo "Imported signing identity: $CERT_ID"
```

## 11. tauri-action에 서명/공증 환경 변수 추가

기존 `Build and upload release assets` 단계는 모든 matrix platform에서 실행된다. Apple secret을 Linux/Windows job에 넘기지 않도록 macOS용 action과 비-macOS용 action을 분리한다.

```yaml
      - name: Build and upload macOS release assets
        if: startsWith(matrix.platform, 'macos')
        uses: tauri-apps/tauri-action@v0.6.2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_SIGNING_IDENTITY: ${{ env.APPLE_SIGNING_IDENTITY }}
        with:
          tagName: ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
          releaseName: ClipMark ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
          releaseBody: "Installers and bundles are attached to this release."
          releaseDraft: true
          prerelease: ${{ github.event_name == 'workflow_dispatch' && inputs.prerelease || false }}
          generateReleaseNotes: true
          tauriScript: npm run tauri
          args: ${{ matrix.args }}

      - name: Build and upload non-macOS release assets
        if: ${{ !startsWith(matrix.platform, 'macos') }}
        uses: tauri-apps/tauri-action@v0.6.2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
          releaseName: ClipMark ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
          releaseBody: "Installers and bundles are attached to this release."
          releaseDraft: true
          prerelease: ${{ github.event_name == 'workflow_dispatch' && inputs.prerelease || false }}
          generateReleaseNotes: true
          tauriScript: npm run tauri
          args: ${{ matrix.args }}
```

Tauri는 `APPLE_SIGNING_IDENTITY`로 code signing identity를 받고, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`로 Apple notarization을 수행한다.

## 12. DMG를 별도로 공증하고 Release asset 교체

로컬 검증 결과 Tauri build는 `.app` bundle을 공증하고 stapling하지만, 생성된 `.dmg` 컨테이너 자체는 별도 공증 전까지 `spctl --type open`에서 `source=Unnotarized Developer ID`로 거절될 수 있다.

GitHub Release에서 사용자가 직접 내려받는 파일은 `.dmg`이므로, macOS `tauri-action` 다음에 DMG를 별도로 공증하고 기존 release asset을 교체한다.

```yaml
      - name: Notarize and replace macOS DMG release asset
        if: startsWith(matrix.platform, 'macos')
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAG_NAME: ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
        run: |
          DMG_PATH=$(find src-tauri/target -path '*/release/bundle/dmg/*.dmg' -type f | head -1)
          if [ -z "$DMG_PATH" ]; then
            echo "::error::No macOS DMG artifact was found under src-tauri/target."
            find src-tauri/target -maxdepth 8 -path '*/release/bundle/*' -print || true
            exit 1
          fi

          xcrun notarytool submit "$DMG_PATH" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
          xcrun stapler staple "$DMG_PATH"
          xcrun stapler validate "$DMG_PATH"
          spctl --assess --type open --context context:primary-signature --verbose "$DMG_PATH"
          gh release upload "$TAG_NAME" "$DMG_PATH" --clobber
```

`tauri-action`이 먼저 GitHub Release에 DMG를 올릴 수 있으므로, 이 단계는 공증/stapling된 DMG를 `gh release upload --clobber`로 다시 업로드한다.

## 13. keychain cleanup 단계 추가

같은 job의 마지막에 cleanup 단계를 추가한다.

```yaml
      - name: Cleanup Apple certificate
        if: startsWith(matrix.platform, 'macos') && always()
        run: |
          security delete-keychain "$RUNNER_TEMP/app-signing.keychain-db" || true
```

## 14. 전체 위치 예시

최종 흐름은 아래 순서가 되어야 한다.

```yaml
      - name: Install frontend dependencies
        run: npm ci

      - name: Verify release version
        env:
          TAG_NAME: ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
        run: |
          # verify TAG_NAME without the leading v matches package.json,
          # package-lock.json, and src-tauri/tauri.conf.json

      - name: Install Apple certificate
        if: startsWith(matrix.platform, 'macos')
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          # certificate import script

      - name: Build and upload macOS release assets
        if: startsWith(matrix.platform, 'macos')
        uses: tauri-apps/tauri-action@v0.6.2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_SIGNING_IDENTITY: ${{ env.APPLE_SIGNING_IDENTITY }}
        with:
          # existing release options

      - name: Notarize and replace macOS DMG release asset
        if: startsWith(matrix.platform, 'macos')
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAG_NAME: ${{ github.ref_type == 'tag' && github.ref_name || inputs.tag_name }}
        run: |
          # notarize, staple, validate, then gh release upload --clobber

      - name: Build and upload non-macOS release assets
        if: ${{ !startsWith(matrix.platform, 'macos') }}
        uses: tauri-apps/tauri-action@v0.6.2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          # existing release options

      - name: Cleanup Apple certificate
        if: startsWith(matrix.platform, 'macos') && always()
        run: |
          security delete-keychain "$RUNNER_TEMP/app-signing.keychain-db" || true
```

## 15. 릴리스 실행

태그 기반 릴리스:

```sh
npm run release:prepare -- 0.1.2
git push origin HEAD v0.1.2
```

수동 실행:

1. GitHub 저장소의 `Actions` 탭으로 이동한다.
2. `Release` workflow를 선택한다.
3. `Run workflow`를 누른다.
4. `tag_name`에 이미 버전 파일과 일치하는 `v0.1.2`처럼 입력한다.
5. 필요하면 `prerelease`를 선택한다.

## 16. GitHub Actions 로그에서 확인할 것

macOS Apple Silicon과 macOS Intel job에서 다음을 확인한다.

- `Imported signing identity: Developer ID Application: ...`가 출력된다.
- `tauri-action` 단계가 signing identity를 사용한다.
- `.app` notarization 관련 에러 없이 Tauri build가 완료된다.
- `Notarize and replace macOS DMG release asset` 단계에서 DMG notarization status가 `Accepted`로 끝난다.
- `spctl --assess --type open` 결과가 `accepted`로 끝난다.
- GitHub Release에 공증/stapling된 macOS `.dmg`가 attached 된다.

## 17. 다운로드한 산출물 검증

릴리스 draft에서 macOS 산출물을 내려받은 뒤 Mac에서 검증한다.

DMG를 mount한 뒤 `.app` 경로를 확인한다.

```sh
codesign --verify --deep --strict --verbose=2 /Applications/ClipMark.app
spctl --assess --type execute --verbose /Applications/ClipMark.app
xcrun stapler validate /Applications/ClipMark.app
```

기대 결과:

- `codesign`이 에러 없이 종료된다.
- `spctl` 결과에 `accepted`가 포함된다.
- `stapler validate`가 ticket이 유효하다고 보고한다.

DMG 자체도 확인한다.

```sh
spctl --assess --type open --context context:primary-signature --verbose path/to/ClipMark.dmg
xcrun stapler validate path/to/ClipMark.dmg
```

기대 결과:

- DMG `spctl` 결과에 `accepted`가 포함된다.
- DMG `stapler validate`가 ticket이 유효하다고 보고한다.

로컬 keychain에 signing certificate가 없으면 `.app` 검증에서 `Authority=(unavailable)` 또는 `invalid signature`처럼 보일 수 있다. 이 경우 `.env`의 `APPLE_CERTIFICATE`를 임시 keychain에 import한 상태에서 다시 검증하거나, CI의 `Install Apple certificate` 단계 안에서 검증한다.

## 18. 자주 나는 오류

### Developer ID Application certificate was not found

`.p12`에 `Developer ID Application` 인증서와 private key가 함께 들어가지 않은 경우다. Keychain Access에서 인증서만 export하지 말고 private key까지 포함해 다시 export한다.

### No identity found

base64 값이 깨졌거나 `APPLE_CERTIFICATE_PASSWORD`가 틀렸을 가능성이 높다. `APPLE_CERTIFICATE`를 다시 생성하고 secret 앞뒤 공백이 들어가지 않았는지 확인한다.

### Notarization authentication failed

`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` 중 하나가 틀렸을 수 있다. `APPLE_PASSWORD`는 Apple 계정 로그인 비밀번호가 아니라 앱 전용 비밀번호다.

### You must first sign the relevant contracts online

Apple Developer 계정의 계약이나 멤버십 상태가 완료되지 않은 경우다. App Store Connect와 Apple Developer 계정 상태를 확인한다.

### Gatekeeper still blocks the app

서명만 되고 공증 또는 stapling이 실패했을 수 있다. `xcrun stapler validate`와 `spctl --assess`를 먼저 확인한다.

### DMG is rejected as Unnotarized Developer ID

`.app` 공증은 성공했지만 `.dmg` 컨테이너가 별도로 공증되지 않은 상태다. `xcrun notarytool submit path/to/ClipMark.dmg --wait`, `xcrun stapler staple path/to/ClipMark.dmg`, `spctl --assess --type open ...` 순서로 DMG 자체를 공증한다.

## 19. 로컬에서 서명 identity만 테스트

CI 전에 로컬 Mac에서 signing identity가 제대로 잡히는지 확인할 수 있다.

```sh
security find-identity -v -p codesigning
APPLE_SIGNING_IDENTITY="Developer ID Application: <Developer Name> (<TEAM_ID>)" npm run tauri:build
```

공증까지 로컬에서 테스트하려면 다음 환경 변수를 같이 지정한다.

```sh
APPLE_ID="you@example.com" \
APPLE_PASSWORD="app-specific-password" \
APPLE_TEAM_ID="<TEAM_ID>" \
APPLE_SIGNING_IDENTITY="Developer ID Application: <Developer Name> (<TEAM_ID>)" \
npm run tauri:build
```

민감 정보는 shell history나 공유 로그에 남기지 않는다. 로컬에서는 임시 `.env` 파일을 쓰더라도 커밋하지 않는다.

## 20. 완료 기준

아래가 모두 만족되면 Gatekeeper 차단 방지용 릴리스 파이프라인이 준비된 것이다.

- `npm run release:prepare -- <version>`으로 버전 bump 커밋과 태그를 만들었다.
- `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`의 릴리스 버전이 태그와 일치한다.
- GitHub secrets 5개가 모두 등록되어 있다.
- macOS job이 `Developer ID Application` identity를 찾는다.
- Tauri release action에 `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`가 전달된다.
- `.app` 산출물이 `codesign`, `spctl`, `stapler validate` 검증을 통과한다.
- `.dmg` 산출물이 별도 `notarytool submit`, `stapler staple`, `spctl --type open` 검증을 통과한다.

## 참고

- Tauri v2 macOS signing: `https://v2.tauri.app/distribute/sign/macos`
- Tauri v2 GitHub Actions release pipeline: `https://v2.tauri.app/distribute/pipelines/github`
- ClipMark 릴리스 workflow: `.github/workflows/release.yml`
- ClipMark Tauri 설정: `src-tauri/tauri.conf.json`
