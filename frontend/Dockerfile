FROM nginx:1.30-alpine

COPY --from=nginx_config /default.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
