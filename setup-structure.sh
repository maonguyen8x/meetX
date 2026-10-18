#!/usr/bin/env bash
# Creates the empty source tree from docs/04-folder-structure.md
set -e
mkdir -p .github/{prompts,workflows} docs infra tests/e2e packages/{shared/src/{schemas,types},config}
mkdir -p apps/api/{prisma,test/{fakes,fixtures}} apps/api/src/{config,db,plugins,utils,integrations/livekit}
mkdir -p apps/api/src/modules/{auth,users,settings,meetings,memory,usage,billing,export,bots}
mkdir -p apps/api/src/realtime/pipeline
mkdir -p apps/api/src/providers/{stt,translate/prompts,tts,meeting-bot}
mkdir -p apps/web/src/{components/ui,features/{bot-session,room,settings,usage,history},hooks,lib/audio,stores,messages,styles}
mkdir -p "apps/web/src/app/[locale]/"{dashboard,meeting-bot,settings,usage,history} "apps/web/src/app/[locale]/room/[id]"
echo "Structure created."
