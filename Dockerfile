# Etapa de construção do frontend
FROM node:20.11-alpine AS builder

WORKDIR /app

# Reduce registry chatter and be more tolerant of transient DNS/network issues
ENV NPM_CONFIG_AUDIT=false \
	NPM_CONFIG_FUND=false \
	NPM_CONFIG_FETCH_RETRIES=5 \
	NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
	NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
	NODE_OPTIONS="--dns-result-order=ipv4first"

# Copia os arquivos de configuração primeiro
COPY package*.json ./

# Instala as dependências
RUN npm ci

# Copia o restante do código fonte
COPY . .

# Build da aplicação React
RUN npm run build

# Etapa de produção
FROM node:20.11-alpine AS runner

WORKDIR /app

# Reduce registry chatter and be more tolerant of transient DNS/network issues
ENV NPM_CONFIG_AUDIT=false \
	NPM_CONFIG_FUND=false \
	NPM_CONFIG_FETCH_RETRIES=5 \
	NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
	NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
	NODE_OPTIONS="--dns-result-order=ipv4first"

# Copia apenas os arquivos necessários
COPY package*.json ./

# Instala apenas dependências de produção
ENV NODE_ENV=production
RUN npm ci --omit=dev

# Copia os arquivos do servidor
COPY --from=builder /app/addon ./addon

# Copia os arquivos buildados do React
COPY --from=builder /app/dist ./dist

# Copia a pasta public com as imagens
COPY --from=builder /app/public ./public

# Exposição da porta
EXPOSE 1337

# Comando para iniciar o servidor
ENTRYPOINT ["node", "addon/server.js"] 