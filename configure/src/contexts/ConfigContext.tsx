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
  const [groqkey, setGroqKey] = useState("");
  const [mdblistkey, setMdblistkey] = useState("");
  const [traktAccessToken, setTraktAccessToken] = useState("");
  const [traktRefreshToken, setTraktRefreshToken] = useState("");
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [includeAdult, setIncludeAdult] = useState(false);
  const [provideImdbId, setProvideImdbId] = useState(false);
  const [returnImdbId, setReturnImdbId] = useState(false);
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
  const [showAgeRatingInGenres, setShowAgeRatingInGenres] = useState(true);
  const [enableAgeRating, setEnableAgeRating] = useState(false);
  const [showAgeRatingWithImdbRating, setShowAgeRatingWithImdbRating] = useState(false);
  const [strictRegionFilter, setStrictRegionFilter] = useState(false);
  const [digitalReleaseFilter, setDigitalReleaseFilter] = useState(false);

  const CONFIG_STORAGE_KEY = 'tmdb-addon-config';

  const saveConfigToStorage = () => {
    try {
      const config = {
        rpdbkey,
        rpdbMediaTypes,
        geminikey,
        groqkey,
        mdblistkey,
        traktAccessToken,
        traktRefreshToken,
        tmdbApiKey,
        includeAdult,
        provideImdbId,
        returnImdbId,
        tmdbPrefix,
        hideEpisodeThumbnails,
        language,
        sessionId,
        streaming,
        catalogs,
        ageRating,
        searchEnabled,
        hideInCinemaTag,
        castCount,
        showAgeRatingInGenres,
        enableAgeRating,
        showAgeRatingWithImdbRating,
        strictRegionFilter,
        digitalReleaseFilter,
      };
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving config to storage:', error);
    }
  };

  const loadConfigFromStorage = () => {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading config from storage:', error);
      return null;
    }
  };

  const applyConfig = (config: any) => {
    if (config.rpdbkey !== undefined) setRpdbkey(config.rpdbkey);
    if (config.rpdbMediaTypes) {
      setRpdbMediaTypes({
        poster: config.rpdbMediaTypes.poster !== false,
        logo: config.rpdbMediaTypes.logo === true,
        backdrop: config.rpdbMediaTypes.backdrop === true
      });
    }
    if (config.mdblistkey !== undefined) setMdblistkey(config.mdblistkey);
    if (config.geminikey !== undefined) setGeminiKey(config.geminikey);
    if (config.groqkey !== undefined) setGroqKey(config.groqkey);
    if (config.traktAccessToken !== undefined) setTraktAccessToken(config.traktAccessToken);
    if (config.traktRefreshToken !== undefined) setTraktRefreshToken(config.traktRefreshToken);
    if (config.tmdbApiKey !== undefined) setTmdbApiKey(config.tmdbApiKey);
    if (config.provideImdbId !== undefined) setProvideImdbId(config.provideImdbId === "true" || config.provideImdbId === true);
    if (config.returnImdbId !== undefined) setReturnImdbId(config.returnImdbId === "true" || config.returnImdbId === true);
    if (config.tmdbPrefix !== undefined) setTmdbPrefix(config.tmdbPrefix === "true" || config.tmdbPrefix === true);
    if (config.hideEpisodeThumbnails !== undefined) setHideEpisodeThumbnails(config.hideEpisodeThumbnails === "true" || config.hideEpisodeThumbnails === true);
    if (config.sessionId !== undefined) setSessionId(config.sessionId);
    if (config.ageRating !== undefined) setAgeRating(config.ageRating);
    if (config.includeAdult !== undefined) setIncludeAdult(config.includeAdult === "true" || config.includeAdult === true);
    if (config.language !== undefined) setLanguage(config.language);
    if (config.hideInCinemaTag !== undefined) setHideInCinemaTag(config.hideInCinemaTag === "true" || config.hideInCinemaTag === true);
    if (config.castCount !== undefined) setCastCount(config.castCount === "Unlimited" ? undefined : Number(config.castCount));
    if (config.enableAgeRating !== undefined) setEnableAgeRating(config.enableAgeRating === "true" || config.enableAgeRating === true);
    if (config.showAgeRatingInGenres !== undefined) setShowAgeRatingInGenres(config.showAgeRatingInGenres === "true" || config.showAgeRatingInGenres === true);
    if (config.showAgeRatingWithImdbRating !== undefined) setShowAgeRatingWithImdbRating(config.showAgeRatingWithImdbRating === "true" || config.showAgeRatingWithImdbRating === true);
    if (config.strictRegionFilter !== undefined) setStrictRegionFilter(config.strictRegionFilter === "true" || config.strictRegionFilter === true);
    if (config.digitalReleaseFilter !== undefined) setDigitalReleaseFilter(config.digitalReleaseFilter === "true" || config.digitalReleaseFilter === true);
    if (config.searchEnabled !== undefined) setSearchEnabled(config.searchEnabled === "true" || config.searchEnabled === true);

    if (config.catalogs) {
      const catalogsWithNames = config.catalogs.map((catalog: any) => {
        const existingCatalog = allCatalogs.find(
          c => c.id === catalog.id && c.type === catalog.type
        );
        return {
          ...catalog,
          name: existingCatalog?.name || catalog.id,
          enabled: catalog.enabled !== undefined ? catalog.enabled : true
        };
      });
      setCatalogs(catalogsWithNames);

      const selectedStreamingServices = new Set(
        catalogsWithNames
          .filter((catalog: any) => catalog.id.startsWith('streaming.'))
          .map((catalog: any) => catalog.id.split('.')[1])
      );

      setStreaming(Array.from(selectedStreamingServices) as string[]);
    } else if (config.catalogs === undefined) {
      loadDefaultCatalogs();
    }
  };

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
      // Verifica se há query params de autenticação (TMDB ou Trakt)
      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthParams = urlParams.has('request_token') || urlParams.has('code');

      // Se há params de autenticação, tenta restaurar do localStorage primeiro
      if (hasAuthParams) {
        const storedConfig = loadConfigFromStorage();
        if (storedConfig) {
          applyConfig(storedConfig);
          // Limpa o localStorage após restaurar
          localStorage.removeItem(CONFIG_STORAGE_KEY);
          return;
        }
      }

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
    groqkey,
    mdblistkey,
    traktAccessToken,
    traktRefreshToken,
    tmdbApiKey,
    includeAdult,
    provideImdbId,
    returnImdbId,
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
    showAgeRatingInGenres,
    enableAgeRating,
    showAgeRatingWithImdbRating,
    strictRegionFilter,
    digitalReleaseFilter,
    setRpdbkey,
    setFanartApiKey,
    setGeminiKey,
    setGroqKey,
    setMdblistkey,
    setTraktAccessToken,
    setTraktRefreshToken,
    setTmdbApiKey,
    setIncludeAdult,
    setProvideImdbId,
    setReturnImdbId,
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