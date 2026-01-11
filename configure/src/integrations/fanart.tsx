import { useConfig } from "@/contexts/ConfigContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Fanart() {
  const { fanartApiKey, setFanartApiKey } = useConfig();

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Optional: Add your Fanart.tv API key to improve logo fetching. If omitted, the addon will
          fall back to TMDB logos.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="fanartApiKey">Fanart.tv API Key</Label>
        <Input
          id="fanartApiKey"
          type="password"
          placeholder="Enter your Fanart.tv API key"
          value={fanartApiKey}
          onChange={(e) => setFanartApiKey(e.target.value)}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
