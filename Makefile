ifeq (${TARGET},)
TARGET := dev
endif

DOCKER_COMPOSE = docker-compose --file .docker/docker-compose.yml --file .docker/docker-compose.$(TARGET).yml
DATA_VOLUME := $(shell pwd)
IMAGE := liberoadmin/prc-frontend
IMAGE_TAG := local
PORT := 8080

export IMAGE
export IMAGE_TAG

.PHONY: build clean* dev find-* install lint* list-users prod release test* update-event-data

dev: export TARGET = dev
dev: .env install build
	${DOCKER_COMPOSE} up --abort-on-container-exit --exit-code-from app

prod: export TARGET = prod
prod: .env build
	${DOCKER_COMPOSE} up --abort-on-container-exit --exit-code-from app

.env:
	cp .env.example .env

lint: export TARGET = dev
lint: build
	${DOCKER_COMPOSE} run --rm app npm run lint

lint\:fix: export TARGET = dev
lint\:fix: build
	${DOCKER_COMPOSE} run --rm -e ESLINT=--fix app npm run lint

test: export TARGET = dev
test: build
	${DOCKER_COMPOSE} run --rm app npm run test

test\:coverage: export TARGET = dev
test\:coverage: build
	${DOCKER_COMPOSE} run --rm app npm run test:coverage

build:
	$(DOCKER_COMPOSE) build

install: node_modules

node_modules: package.json package-lock.json
	npm install
	touch node_modules

clean:
	rm -rf .eslint .jest build node_modules

clean\:db:
	$(DOCKER_COMPOSE) down

find-elife-endorsements: export TARGET = dev
find-elife-endorsements: build
	$(DOCKER_COMPOSE) run -T app \
	 	npx ts-node scripts/find-endorsements-from-biorxiv 10.7554 > ./data/endorsements/b560187e-f2fb-4ff9-a861-a204f3fc0fb0.csv

find-peerj-endorsements: export TARGET = dev
find-peerj-endorsements: build
	$(DOCKER_COMPOSE) run -T app \
		npx ts-node scripts/find-endorsements-from-biorxiv 10.7717 > ./data/endorsements/53ed5364-a016-11ea-bb37-0242ac130002.csv

find-review-commons-reviews: export TARGET = dev
find-review-commons-reviews: build
	$(DOCKER_COMPOSE) run -T app \
		npx ts-node scripts/find-reviews-from-hypothesis NEGQVabn > ./data/reviews/316db7d9-88cc-4c26-b386-f067e0f56334.csv

find-elife-reviews: export TARGET = dev
find-elife-reviews: build
	$(DOCKER_COMPOSE) run -T app \
		npx ts-node scripts/find-reviews-from-hypothesis q5X6RWJ6 > ./data/reviews/b560187e-f2fb-4ff9-a861-a204f3fc0fb0.csv

find-peerj-reviews: export TARGET = dev
find-peerj-reviews: build
	$(DOCKER_COMPOSE) run -T app \
		npx ts-node scripts/find-reviews-from-crossref-via-biorxiv 10.7717 10.7287 > ./data/reviews/53ed5364-a016-11ea-bb37-0242ac130002.csv

find-pci-reviews: export TARGET = dev
find-pci-reviews: build
	$(DOCKER_COMPOSE) run -T app \
		npx ts-node scripts/find-reviews-from-pci

find-prereview-reviews: export TARGET = dev
find-prereview-reviews: build
	$(DOCKER_COMPOSE) run -T app \
		npx ts-node scripts/find-reviews-from-prereview > ./data/reviews/10360d97-bf52-4aef-b2fa-2f60d319edd7.csv

COMMUNITY_SCRIPTS := \
	find-elife-endorsements \
	find-peerj-endorsements \
	find-review-commons-reviews \
	find-elife-reviews \
	find-peerj-reviews \
	find-pci-reviews \
	find-prereview-reviews

update-event-data: $(COMMUNITY_SCRIPTS)
	find data -type f | xargs -I % sort -g -o % %

release: export TAG = latest/$(shell date +%Y%m%d%H%M)
release:
	git tag $$TAG
	git push origin $$TAG

psql:
	$(DOCKER_COMPOSE) exec db sh -c "PGUSER=user PGHOST=db PGPASSWORD=secret PGDATABASE=thehive psql"

funnel:
	$(DOCKER_COMPOSE) exec db sh -c \
	"PGUSER=user PGHOST=db PGPASSWORD=secret PGDATABASE=thehive \
	psql -c \" \
	  SELECT \
	    e_landed.payload->>'visitorId' AS landed, \
		e_acquired.payload->>'userId' AS acquired, \
		COUNT(*) AS followed \
	  FROM (SELECT * FROM events WHERE events.type = 'VisitorLanded') e_landed \
	  LEFT OUTER JOIN (SELECT * FROM events WHERE events.type = 'UserAcquired') e_acquired \
	  ON e_landed.payload->>'visitorId' = e_acquired.payload->>'visitorId' \
	  LEFT OUTER JOIN (SELECT * FROM events WHERE events.type = 'UserFollowedEditorialCommunity') e_followed \
	  ON e_acquired.payload->>'userId' = e_followed.payload->>'userId' \
	  WHERE e_landed.date >= '2020-10-01 00:00:00'::timestamp \
	  AND e_landed.date < '2020-10-02 00:00:00'::timestamp \
	  GROUP BY landed, acquired, e_landed.payload->>'visitorId' \
	  \" \
	"

list-users:
	kubectl exec -it prc--prod-postgresql-0 -- sh -c \
		"PGDATABASE=thehive PGUSER=app PGPASSWORD=$$( \
			kubectl get secret prc--prod-postgresql -o json \
			| jq -r '.data."postgresql-password"' \
			| base64 -d \
		) \
		psql -c \"SELECT DISTINCT payload -> 'userId' AS userid FROM events\""
