import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Soft banner that asks the user to share their location.
 * Shows once per session; dismissible; saves to DB via tRPC.
 */
export default function LocationCapture() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const locationQuery = trpc.location.get.useQuery();
  const updateLocation = trpc.location.update.useMutation();

  useEffect(() => {
    // Only show if location not already saved and user hasn't dismissed this session
    const dismissed = sessionStorage.getItem("locationDismissed");
    if (!dismissed && locationQuery.data !== undefined && !locationQuery.data?.latitude) {
      setShow(true);
    }
  }, [locationQuery.data]);

  const handleAllow = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await updateLocation.mutateAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          toast.success("Location saved — we'll show you nearby matches!");
          setShow(false);
        } catch {
          toast.error("Failed to save location.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.warn("Geolocation denied:", err.message);
        toast.info("Location access denied — proximity filtering won't be available.");
        setLoading(false);
        dismiss();
      },
      { timeout: 10000 }
    );
  };

  const dismiss = () => {
    sessionStorage.setItem("locationDismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
      <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
      <div className="flex-1 text-sm text-blue-900">
        <span className="font-medium">Enable location</span> to see matches near you and filter by distance.
      </div>
      <Button
        size="sm"
        onClick={handleAllow}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
      >
        {loading ? "Locating…" : "Allow"}
      </Button>
      <button onClick={dismiss} className="text-blue-400 hover:text-blue-600 ml-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
