# sakura-push Cloud Run イメージ
# esbuild で dist/index.js に全依存バンドル済みなので、ランタイムは極小
FROM node:22-slim

WORKDIR /app

# 事前に `npm run build` 済みの単一ファイルをコピー
COPY dist/index.js ./index.js

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
