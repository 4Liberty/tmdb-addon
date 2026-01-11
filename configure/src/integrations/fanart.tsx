import { useEffect, useState } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Fanart() {
  const { fanartApiKey, setFanartApiKey } = useConfig();
  const [tempKey, setTempKey] = useState(fanartApiKey || "");

  useEffect(() => {
    setTempKey(fanartApiKey || "");
  }, [fanartApiKey]);

  const handleSave = () => {
    setFanartApiKey(tempKey);
  };

  const handleCancel = () => {
    setTempKey(fanartApiKey || "");
  };

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
          value={tempKey}
          onChange={(e) => setTempKey(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button variant="outline" type="button" onClick={handleCancel}>
            Cancel
          </Button>
        </DialogClose>
        <DialogClose asChild>
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}
