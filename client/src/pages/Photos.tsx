import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Trash2, Star, GripVertical } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Photos() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const photosQuery = trpc.photos.getPhotos.useQuery();
  const uploadMutation = trpc.photos.uploadPhoto.useMutation();
  const setMainMutation = trpc.photos.setMainPhoto.useMutation();
  const deleteMutation = trpc.photos.deletePhoto.useMutation();
  const reorderMutation = trpc.photos.reorderPhotos.useMutation();

  const photos = photosQuery.data || [];
  const mainPhoto = photos.find((p) => p.isMain === 1);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      try {
        // Read file as base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(",")[1];
          if (base64) {
            const result = await uploadMutation.mutateAsync({
              fileName: file.name,
              mimeType: file.type,
              fileData: base64,
            });

            // Add photo to database
            await trpc.photos.addPhoto.useMutation().mutateAsync({
              s3Key: result.s3Key,
              cdnUrl: result.cdnUrl,
              isMain: photos.length === 0, // First photo is main
            });

            await photosQuery.refetch();
            toast.success(`${file.name} uploaded successfully`);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleSetMain = async (photoId: number) => {
    try {
      await setMainMutation.mutateAsync({ photoId });
      await photosQuery.refetch();
      toast.success("Main photo updated");
    } catch (error) {
      toast.error("Failed to set main photo");
    }
  };

  const handleDelete = async (photoId: number) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    try {
      await deleteMutation.mutateAsync({ photoId });
      await photosQuery.refetch();
      toast.success("Photo deleted");
    } catch (error) {
      toast.error("Failed to delete photo");
    }
  };

  if (authLoading || photosQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Profile Photos
          </h1>
          <p className="text-slate-600">
            Upload multiple photos and select your main avatar. High-quality photos increase match chances!
          </p>
        </div>

        {/* Upload Area */}
        <Card
          className={`p-8 border-2 border-dashed transition-colors cursor-pointer ${
            dragActive
              ? "border-rose-500 bg-rose-50"
              : "border-slate-300 hover:border-rose-300"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          <div className="text-center">
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Drop photos here or click to browse
            </h3>
            <p className="text-sm text-slate-600">
              Supported formats: JPEG, PNG, WebP, GIF (max 10MB each)
            </p>
          </div>
        </Card>

        {/* Main Avatar Display */}
        {mainPhoto && (
          <Card className="p-6 bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200">
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={mainPhoto.cdnUrl}
                  alt="Main avatar"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-1">
                  <Star className="w-4 h-4 fill-current" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Your Main Avatar</h3>
                <p className="text-sm text-slate-600">
                  This is the photo shown to potential matches
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Photos Grid */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Your Photos ({photos.length}/10)
          </h3>

          {photos.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
              <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No photos yet. Upload your first photo!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-slate-100">
                    <img
                      src={photo.cdnUrl}
                      alt={`Photo ${photo.displayOrder}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Main Badge */}
                    {photo.isMain === 1 && (
                      <div className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-1">
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {photo.isMain !== 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-slate-900 hover:bg-slate-100"
                          onClick={() => handleSetMain(photo.id)}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          Set Main
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(photo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Drag Handle */}
                  <div className="absolute bottom-2 left-2 bg-slate-900/50 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        {photos.length > 0 && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">Photo Tips</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex gap-2">
                <span>•</span>
                <span><strong>Variety:</strong> Include photos from different settings and activities</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span><strong>Quality:</strong> Use clear, well-lit photos with good composition</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span><strong>Authenticity:</strong> Show yourself as you really are</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span><strong>Main avatar:</strong> Choose a clear headshot as your main photo</span>
              </li>
            </ul>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
