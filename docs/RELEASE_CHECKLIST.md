# Release và Submission Checklist — v1.0.0

## Freeze scope

- [x] Không thêm feature, API, table hoặc column.
- [x] Không đổi authentication, RBAC hoặc Docker architecture.
- [x] Release version chọn là `v1.0.0`.
- [x] Known limitations được ghi trung thực.

## Repository và security

- [x] Git status và toàn bộ untracked source đã được review.
- [x] `.gitignore` và hai `.dockerignore` đã được review.
- [x] Local `.env` bị ignore; `.env.example` chỉ dùng placeholder.
- [x] Không phát hiện real OpenAI key, active JWT, private key hoặc personal path.
- [x] Không phát hiện cache/log/tmp/bak artifact trong source package.
- [ ] Final commit được tạo sau user review.
- [ ] Fresh clone được kiểm thử từ final commit.
- [ ] Annotated tag `v1.0.0` được tạo sau fresh-clone PASS.
- [ ] Remote được cấu hình và push bởi người có thẩm quyền.

## Dependencies và build

- [x] `package.json`/`package-lock.json` dùng được với `npm ci`.
- [x] Chỉ có một QR scanner library: `html5-qrcode`.
- [x] Backend dependencies được pin trong `requirements.txt`.
- [x] Docker no-cache build PASS.
- [x] Frontend production build PASS.
- [x] Production npm audit (`--omit=dev`) không có vulnerability.
- [x] Hai advisory dev-tooling được ghi nhận và không force-upgrade trong freeze.

## Runtime và data

- [x] `db`, `backend`, `frontend` đạt healthy.
- [x] `/api/health`, `/api/health/database`, `/docs`, `/openapi.json` trả 200.
- [x] Regression/E2E Step 16, 18, 19, 29, 30, 31 PASS.
- [x] 9 bảng nghiệp vụ, không có test table thừa.
- [x] Không có destructive startup command.
- [x] Persistence PASS sau `restart` và `down`/`up` không `-v`.
- [x] Demo Event có Speaker, Schedule, Registration, active unchecked Ticket, CheckIn, Feedback và Announcement.
- [x] Không có duplicate Registration/Ticket/CheckIn/Feedback group.

## Documentation

- [x] README và Quick Start.
- [x] Setup, Architecture, Modules và API Summary.
- [x] Demo Guide và Troubleshooting.
- [x] Defense Guide, Defense Q&A và Demo Checklist.
- [x] Relative links và API inventory audit.
- [x] Release notes và submission instructions.

## Submission ZIP

Tên khuyến nghị: `event-manager-ai-v1.0.0.zip`.

Include:

- `backend/`, `frontend/`, `docs/`.
- `docker-compose.yml`, Dockerfiles và dockerignore files.
- `README.md`, `RELEASE_NOTES.md`, `DEMO_GUIDE.md` compatibility link.
- `.gitignore`, root/service `.env.example` files.
- `package.json`, `package-lock.json`, `requirements.txt`.

Exclude:

- `.git/`, `.env` và mọi real secret.
- `node_modules/`, `dist/`, `__pycache__/`, `*.pyc`, logs và coverage.
- Docker images, containers, volumes hoặc database dump.
- Personal credentials, active JWT và private keys.

## Commands sau khi final commit được duyệt

Xác minh branch/remote trước khi dùng. Repository hiện chưa có remote được xác minh.

```text
git status
git add <reviewed-files>
git commit -m "release: finalize Event Manager AI v1.0.0"
git tag -a v1.0.0 -m "Event Manager AI v1.0.0"
git push origin <verified-branch>
git push origin v1.0.0
```

Không force push. Không tạo tag nếu final commit, build hoặc fresh clone chưa PASS.
