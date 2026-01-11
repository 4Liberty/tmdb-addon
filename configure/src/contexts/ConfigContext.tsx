import React, { createContext, useContext, useEffect, useState } from "react";
import { ConfigContext, type ConfigContextType, type CatalogConfig } from "./config";
import { 
  baseCatalogs, 
  authCatalogs, 
  streamingCatalogs 
} from "@/data/catalogs";
import { decompressFromEncodedURIComponent } from 'lz-string';

const allCatalogs = [
  ...baseCatalogs,
  ...authCatalogs,
  ...Object.values(streamingCatalogs).flat()
];

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [rpdbkey, setRpdbkey] = useState("");
  const [fanartApiKey, setFanartApiKey] = useState("");
  const [geminikey, setGeminiKey] = useState("");
  const [mdblistkey, setMdblistkey] = useState("");
  const [includeAdult, setIncludeAdult] = useState(false);
  const [provideImdbId, setProvideImdbId] = useState(false);
  const [tmdbPrefix, setTmdbPrefix] = useState(false);
  const [hideEpisodeThumbnails, setHideEpisodeThumbnails] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [sessionId, setSessionId] = useState("");
  const [traktAccessToken, setTraktAccessToken] = useState("");
  const [traktRefreshToken, setTraktRefreshToken] = useState("");
  const [streaming, setStreaming] = useState<string[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogConfig[]>([]);
  const [ageRating, setAgeRating] = useState<string | undefined>(undefined);
  const [searchEnabled, setSearchEnabled] = useState<boolean>(true);
  const [hideInCinemaTag, setHideInCinemaTag] = useState(false);
  const [castCount, setCastCount] = useState<number | undefined>(5);

  const loadDefaultCatalogs = () => {
    const defaultCatalogs = baseCatalogs.map(catalog => ({
      ...catalog,
      enabled: true,
      showInHome: true
    }));
    setCatalogs(defaultCatalogs);
  };

  const asBool = (value: unknown): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return undefined;
  };

  const applyConfig = (config: any) => {
    if (config.rpdbkey) setRpdbkey(config.rpdbkey);
    if (config.fanartApiKey) setFanartApiKey(config.fanartApiKey);
    if (config.mdblistkey) setMdblistkey(config.mdblistkey);
    if (config.geminikey) setGeminiKey(config.geminikey);

    const provideImdbId = asBool(config.provideImdbId);
    if (provideImdbId !== undefined) setProvideImdbId(provideImdbId);

    const tmdbPrefix = asBool(config.tmdbPrefix);
    if (tmdbPrefix !== undefined) setTmdbPrefix(tmdbPrefix);

    const hideEpisodeThumbnails = asBool(config.hideEpisodeThumbnails);
    if (hideEpisodeThumbnails !== undefined) setHideEpisodeThumbnails(hideEpisodeThumbnails);

    if (config.sessionId) setSessionId(config.sessionId);
    if (config.traktAccessToken) setTraktAccessToken(config.traktAccessToken);
    if (config.traktRefreshToken) setTraktRefreshToken(config.traktRefreshToken);
    if (config.ageRating) setAgeRating(config.ageRating);

    const includeAdult = asBool(config.includeAdult);
    if (includeAdult !== undefined) setIncludeAdult(includeAdult);

    if (config.language) setLanguage(config.language);

    const hideInCinemaTag = asBool(config.hideInCinemaTag);
    if (hideInCinemaTag !== undefined) setHideInCinemaTag(hideInCinemaTag);

    if (config.castCount !== undefined) {
      setCastCount(config.castCount === "Unlimited" ? undefined : Number(config.castCount));
    }

    if (config.catalogs) {
      const catalogsWithNames = config.catalogs.map((catalog: any) => {
        const existingCatalog = allCatalogs.find(
          (c) => c.id === catalog.id && c.type === catalog.type
        );
        return {
          ...catalog,
          name: existingCatalog?.name || catalog.id,
          enabled: catalog.enabled !== undefined ? catalog.enabled : true,
        };
      });
      setCatalogs(catalogsWithNames);

      const selectedStreamingServices = new Set(
        catalogsWithNames
          .filter((catalog: any) => String(catalog.id || "").startsWith("streaming."))
          .map((catalog: any) => String(catalog.id || "").split(".")[1])
      );
      setStreaming(Array.from(selectedStreamingServices) as string[]);
    } else {
      loadDefaultCatalogs();
    }

    const searchEnabled = asBool(config.searchEnabled);
    if (searchEnabled !== undefined) setSearchEnabled(searchEnabled);
  };

  const loadConfigFromUrl = () => {
    try {
      const path = window.location.pathname.split('/')[1];
      const decompressedConfig = decompressFromEncodedURIComponent(path);
      const config = JSON.parse(decompressedConfig);

      applyConfig(config);
      
      window.history.replaceState({}, '', '/configure');
    } catch (error) {
      console.error('Error loading config from URL:', error);
      loadDefaultCatalogs(); 
    }
  };

  const loadConfigFromString = (input: string) => {
    const raw = (input || "").trim();
    if (!raw) throw new Error("Paste a manifest link or encoded config.");

    const normalized = raw
      // Some flows produce stremio://https://...
      .replace(/^stremio:\/\/(https?:\/\/)/i, "$1")
      // Our install button produces stremio://domain/...
      .replace(/^stremio:\/\//i, "https://");

    const extractEncoded = (value: string): string => {
      try {
        const url = new URL(value);
        const segments = url.pathname.split("/").filter(Boolean);
        const manifestIndex = segments.findIndex((s) => s === "manifest.json");
        if (manifestIndex > 0) return segments[manifestIndex - 1];
        if (segments.length >= 1) return segments[0];
        return "";
      } catch {
        const cleaned = value.split("?")[0].split("#")[0];
        const segments = cleaned.split("/").filter(Boolean);
        if (segments.length === 0) return cleaned;
        if (segments[segments.length - 1] === "manifest.json") {
          return segments[segments.length - 2] || "";
        }
        return segments[0];
      }
    };

    const encoded = extractEncoded(normalized);
    if (!encoded) throw new Error("Could not find an encoded config in that link.");

    const decompressed = decompressFromEncodedURIComponent(encoded);
    if (!decompressed) throw new Error("Invalid or unsupported config string.");

    const config = JSON.parse(decompressed);
    applyConfig(config);
  };

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('configure')) {
      loadConfigFromUrl();
    } else {
      loadDefaultCatalogs();
    }
  }, []);

  const value = {
    rpdbkey,
    fanartApiKey,
    geminikey,
    mdblistkey,
    includeAdult,
    provideImdbId,
    tmdbPrefix,
    hideEpisodeThumbnails,
    language,
    sessionId,
    traktAccessToken,
    traktRefreshToken,
    streaming,
    catalogs,
    ageRating,
    searchEnabled,
    hideInCinemaTag,
    castCount,
    setRpdbkey,
    setFanartApiKey,
    setGeminiKey,
    setMdblistkey,
    setIncludeAdult,
    setProvideImdbId,
    setTmdbPrefix,
    setHideEpisodeThumbnails,
    setLanguage,
    setSessionId,
    setTraktAccessToken,
    setTraktRefreshToken,
    setStreaming,
    setCatalogs,
    setAgeRating,
    setSearchEnabled,
    setHideInCinemaTag,
    setCastCount,
    loadConfigFromUrl,
    loadConfigFromString
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext); 