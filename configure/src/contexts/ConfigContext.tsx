import React, { useCallback, useContext, useEffect, useState } from "react";
import { ConfigContext, type CatalogConfig, type ConfigContextType, type RPDBMediaTypes } from "./config";
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
  const [rpdbMediaTypes, setRpdbMediaTypes] = useState<RPDBMediaTypes>({
    poster: true,
    logo: false,
    backdrop: false,
  });
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
  const [language, setLanguage] = useState("tr-TR");
  const [sessionId, setSessionId] = useState("");
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

  const asBool = (value: unknown): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return undefined;
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const asString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  const applyConfig = (config: unknown) => {
    if (!isRecord(config)) {
      loadDefaultCatalogs();
      return;
    }

    const rpdbkeyValue = asString(config.rpdbkey);
    if (rpdbkeyValue !== undefined) setRpdbkey(rpdbkeyValue);

    if (isRecord(config.rpdbMediaTypes)) {
      setRpdbMediaTypes({
        poster: config.rpdbMediaTypes.poster !== false,
        logo: config.rpdbMediaTypes.logo === true,
        backdrop: config.rpdbMediaTypes.backdrop === true
      });
    }

    const fanartApiKeyValue = asString(config.fanartApiKey);
    if (fanartApiKeyValue !== undefined) setFanartApiKey(fanartApiKeyValue);
    const mdblistKeyValue = asString(config.mdblistkey);
    if (mdblistKeyValue !== undefined) setMdblistkey(mdblistKeyValue);
    const geminiKeyValue = asString(config.geminikey);
    if (geminiKeyValue !== undefined) setGeminiKey(geminiKeyValue);
    const groqKeyValue = asString(config.groqkey);
    if (groqKeyValue !== undefined) setGroqKey(groqKeyValue);
    const traktAccessTokenValue = asString(config.traktAccessToken);
    if (traktAccessTokenValue !== undefined) setTraktAccessToken(traktAccessTokenValue);
    const traktRefreshTokenValue = asString(config.traktRefreshToken);
    if (traktRefreshTokenValue !== undefined) setTraktRefreshToken(traktRefreshTokenValue);
    const tmdbApiKeyValue = asString(config.tmdbApiKey);
    if (tmdbApiKeyValue !== undefined) setTmdbApiKey(tmdbApiKeyValue);

    const provide = asBool(config.provideImdbId);
    if (provide !== undefined) setProvideImdbId(provide);
    const ret = asBool(config.returnImdbId);
    if (ret !== undefined) setReturnImdbId(ret);
    const prefix = asBool(config.tmdbPrefix);
    if (prefix !== undefined) setTmdbPrefix(prefix);
    const hideThumbs = asBool(config.hideEpisodeThumbnails);
    if (hideThumbs !== undefined) setHideEpisodeThumbnails(hideThumbs);
    const sessionIdValue = asString(config.sessionId);
    if (sessionIdValue !== undefined) setSessionId(sessionIdValue);
    const ageRatingValue = asString(config.ageRating);
    if (ageRatingValue !== undefined) setAgeRating(ageRatingValue);
    const adult = asBool(config.includeAdult);
    if (adult !== undefined) setIncludeAdult(adult);
    const languageValue = asString(config.language);
    if (languageValue !== undefined) setLanguage(languageValue);
    const hideCinema = asBool(config.hideInCinemaTag);
    if (hideCinema !== undefined) setHideInCinemaTag(hideCinema);
    if (config.castCount !== undefined) {
      if (config.castCount === "Unlimited") {
        setCastCount(undefined);
      } else {
        const nextCastCount = typeof config.castCount === "number" ? config.castCount : Number(config.castCount);
        setCastCount(Number.isFinite(nextCastCount) ? nextCastCount : undefined);
      }
    }

    const enableAR = asBool(config.enableAgeRating);
    if (enableAR !== undefined) setEnableAgeRating(enableAR);
    const showARGenres = asBool(config.showAgeRatingInGenres);
    if (showARGenres !== undefined) setShowAgeRatingInGenres(showARGenres);
    const showARImdb = asBool(config.showAgeRatingWithImdbRating);
    if (showARImdb !== undefined) setShowAgeRatingWithImdbRating(showARImdb);
    const strict = asBool(config.strictRegionFilter);
    if (strict !== undefined) setStrictRegionFilter(strict);
    const digital = asBool(config.digitalReleaseFilter);
    if (digital !== undefined) setDigitalReleaseFilter(digital);
    const search = asBool(config.searchEnabled);
    if (search !== undefined) setSearchEnabled(search);

    if (Array.isArray(config.catalogs)) {
      const catalogsWithNames: CatalogConfig[] = config.catalogs
        .map((catalog): CatalogConfig | null => {
          if (!isRecord(catalog)) return null;
          const id = asString(catalog.id);
          const type = asString(catalog.type);
          if (!id || !type) return null;

          const existingCatalog = allCatalogs.find((c) => c.id === id && c.type === type);

          const enabled = asBool(catalog.enabled);
          const showInHome = asBool(catalog.showInHome);

          return {
            id,
            type,
            name: existingCatalog?.name || id,
            enabled: enabled !== undefined ? enabled : true,
            showInHome: showInHome !== undefined ? showInHome : true,
          };
        })
        .filter((c): c is CatalogConfig => c !== null);

      setCatalogs(catalogsWithNames);

      const selectedStreamingServices = new Set(
        catalogsWithNames
          .filter((catalog) => catalog.id.startsWith('streaming.'))
          .map((catalog) => catalog.id.split('.')[1])
      );

      setStreaming(Array.from(selectedStreamingServices));
    } else if (config.catalogs === undefined) {
      loadDefaultCatalogs();
    }
  };

  const loadDefaultCatalogs = useCallback(() => {
    const defaultCatalogs = baseCatalogs.map(catalog => ({
      ...catalog,
      enabled: true,
      showInHome: true
    }));
    setCatalogs(defaultCatalogs);
  }, []);

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

      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      const queryConfig = urlParams.get('config');

      // Supported sources:
      // - /:encoded/configure (server route: /:catalogChoices?/configure)
      // - /configure?config=:encoded
      let encoded: string | null = null;
      if (queryConfig) {
        encoded = queryConfig;
      } else if (pathSegments.length >= 2 && pathSegments[1] === 'configure' && pathSegments[0] !== 'configure') {
        encoded = pathSegments[0];
      }

      // No config present: just load defaults.
      if (!encoded) {
        loadDefaultCatalogs();
        return;
      }

      const decompressedConfig = decompressFromEncodedURIComponent(encoded);
      if (!decompressedConfig) {
        throw new Error('Invalid encoded config');
      }

      let config: unknown;
      try {
        config = JSON.parse(decompressedConfig);
      } catch {
        throw new Error('Invalid config JSON');
      }

      applyConfig(config);

      window.history.replaceState({}, '', '/configure');
    } catch (error) {
      // Avoid noisy console errors in production (common when users open /configure with no encoded config).
      if (import.meta.env.DEV) {
        console.error('Error loading config from URL:', error);
      }
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
    // Intentional one-time bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: ConfigContextType = {
    rpdbkey,
    rpdbMediaTypes,
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
    setRpdbMediaTypes,
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
    setStreaming,
    setCatalogs,
    setAgeRating,
    setSearchEnabled,
    setHideInCinemaTag,
    setCastCount,
    setShowAgeRatingInGenres,
    setEnableAgeRating,
    setShowAgeRatingWithImdbRating,
    setStrictRegionFilter,
    setDigitalReleaseFilter,
    saveConfigToStorage,
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