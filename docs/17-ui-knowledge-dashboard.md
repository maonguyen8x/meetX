# 17 — Knowledge Dashboard & Documents UI (match the provided reference image)

Reference image: "AI SEARCH — AI Knowledge RAG" dashboard. The text inside the mockup is placeholder gibberish; **copy the layout and style, not the text**.

## Visual style
Glassmorphism: soft mint → teal gradient page background, large rounded glass cards (`rounded-3xl`, `bg-white/60`, `backdrop-blur-xl`, 1px white/50 border, soft shadow), generous padding (24–32), Inter font, headings semibold. Primary color **emerald/teal** (`--primary: #0f9d8a`, hover darker, light tint `#d9f2ec`), text slate-900/slate-500. Dark mode: deep teal-slate background with glass `bg-slate-900/50`. Min tap target 44 px, visible focus ring, reduced-motion respected. (This teal palette replaces the indigo palette in docs/09.)

## Layout of `/[locale]/dashboard/knowledge` (desktop ≥ 1024 px)
1. **App shell card** (rounded outer glass container): top bar with logo mark + wordmark **AI SEARCH**, nav pills `Dashboard | Documents | Settings` (+ `Billing`, `Admin` by permission), right side: notification bell, avatar + name with dropdown (profile, organization switcher, language, theme, sign out).
2. **Page title** "AI Knowledge RAG".
3. **Search bar row** inside a glowing teal-outlined panel: large rounded input with search icon and placeholder "Ask anything to your internal knowledge base…" + three square icon toggle buttons with labels under the icons: **Web Search** (globe), **Thinking** (brain), **Deep Search** (magnifier-with-lines). Toggles show active state (teal fill); Enter submits; folder-scope chip under the input ("Searching in: All folders ▾").
4. **Two-column grid** (`grid-cols-[1fr_1fr]`, left slightly narrower):
   - **Left column**
     - Card **Source Documents** (list): file-type icon in colored rounded square (PDF red, DOC blue, URL link blue, sheet green), title (truncate), date right-aligned; row hover + click opens file info drawer; "⋯" menu top right (view all, filter).
     - Card **Document Chunks** (scrollable, fixed max height): each chunk is a rounded inner card: bold "Chunk N:" + 2-line excerpt with highlighted query terms, footer "Source: <doc title>, p. X". Click scrolls/open the source.
   - **Right column**
     - Card **AI-Generated Answer**: streaming markdown text with clickable citation chips `[1]`, `[2]` (hover shows snippet, click highlights the reference and chunk), copy / regenerate / thumbs buttons, "Thinking…" and Deep Search step-progress list while running, "⋯" menu.
     - Card **References**: rows with icon, title (+ page), URL/source line in teal link color, and the citation numbers `[1]`, `[2]` that use it; web references open in a new tab.
5. Empty state (before first query): illustration + suggested questions + recent conversations. Loading: skeletons. Error: friendly message + retry.
6. **Responsive**: tablet = answer first, then sources/chunks tabs; mobile = single column with sticky search bar and tabs `Answer | Sources | Chunks`.

## Documents page `/[locale]/documents` (folder management, upload, file info)
- **Header**: breadcrumb, `New folder`, `Upload` (primary), view toggle (list/grid), sort, search-in-folder box, storage meter chip (`3.2 GB / 10 GB`).
- **Left pane**: folder tree (expand/collapse, drag & drop to move, context menu rename/move/share/delete, badge for visibility 🔒 private / 🏢 organization / 👥 shared).
- **Main pane**: table/grid of documents: icon, title, type, size, status badge (Ready / Processing with progress / Failed with retry), modified, owner, tags, row actions. Multi-select toolbar (move, tag, delete, reprocess).
- **Upload dropzone**: full-area drag overlay + upload dialog queue with per-file progress, cancel, retry, quota/size/type validation messages; URL import tab.
- **File info drawer (right, 480 px)**: tabs `Details | Preview | Chunks | Versions | Access`. Details shows metadata + status timeline; Chunks tab lists chunks with page numbers and a "search within chunks" input; Access tab manages grants; footer actions download / re-process / replace / delete.
- Trash view with restore.

## Components (apps/web/src/features/knowledge and documents)
`KnowledgeSearchBar`, `SearchModeToggles`, `SourceDocumentsCard`, `DocumentChunksCard`, `AnswerCard` (+ `CitationChip`), `ReferencesCard`, `DeepSearchProgress`, `FolderTree`, `DocumentTable`, `UploadDialog`, `UploadQueue`, `FileInfoDrawer`, `StatusBadge`, `StorageMeter`, `FileTypeIcon`. Hooks: `useKnowledgeSearch` (SSE), `useUpload` (presigned, resumable), `useFolders`, `useDocuments`.

## Acceptance
Pixel-faithful structure to the reference (card order, toggles, citation chips, references list); keyboard accessible; all strings in `vi/en/ja`; Lighthouse accessibility ≥ 95; Playwright flow: upload → status READY → ask question → citations clickable → open file drawer.
