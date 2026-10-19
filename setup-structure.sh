#!/usr/bin/env bash
# Creates the empty source tree from docs/04-folder-structure.md
set -e
mkdir -p .github/{prompts,workflows} docs infra/{caddy,scripts} tests/e2e packages/{shared/src/{schemas,types},config}
mkdir -p apps/api/{prisma/migrations,test/{fakes,fixtures}}
mkdir -p apps/api/src/{config,db,authorization,plugins,utils,jobs,realtime/pipeline,integrations/livekit}
mkdir -p apps/api/src/modules/{auth,users,organizations,admin,audit,settings,meetings,glossary,memory,export,bots,rooms,usage,notifications}
mkdir -p apps/api/src/modules/knowledge/{folders,documents,access,conversations,ingestion,parsers,chunking,retrieval,answer/prompts}
mkdir -p apps/api/src/modules/billing/{plans,subscriptions,invoices,payments,wallet,webhooks}
mkdir -p apps/api/src/providers/{stt,translate/prompts,tts,meeting-bot,embedding,web-search,payment,mailer,storage,ocr}
mkdir -p apps/web/src/{components/ui,hooks,lib/audio,stores,messages,styles}
mkdir -p apps/web/src/features/{knowledge,documents,bot-session,room,settings,billing,admin,org,notifications}
D="apps/web/src/app/[locale]"
mkdir -p "$D"/{dashboard/knowledge,documents,meeting-bot,history,billing,usage,notifications,org,admin,"room/[id]"}
mkdir -p "$D"/settings/{profile,interpreter,languages,memory,knowledge,privacy,notifications,security,appearance}
mkdir -p "$D"/admin/{overview,users,orgs,plans,subscriptions,usage,moderation,audit,system}
mkdir -p "$D"/org/{members,quotas,profile,billing}
echo "Structure created."
