/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string
  readonly MOCKSERVER_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}