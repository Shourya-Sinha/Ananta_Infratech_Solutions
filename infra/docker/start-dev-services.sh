#!/bin/sh
# Starts MongoDB and Redis as plain Docker containers for local development.
# No docker-compose / YAML needed — just two `docker run` calls.

set -e

echo "Starting MongoDB..."
docker run -d \
  --name ananta-mongo \
  -p 27017:27017 \
  -v ananta_mongo_data:/data/db \
  mongo:7 || echo "  (already running or name taken — run 'docker rm -f ananta-mongo' to reset)"

echo "Starting Redis..."
docker run -d \
  --name ananta-redis \
  -p 6379:6379 \
  -v ananta_redis_data:/data \
  redis:7-alpine || echo "  (already running or name taken — run 'docker rm -f ananta-redis' to reset)"

echo ""
echo "Done. MongoDB on localhost:27017, Redis on localhost:6379."
echo "Stop with: docker stop ananta-mongo ananta-redis"
echo "Remove with: docker rm -f ananta-mongo ananta-redis"
