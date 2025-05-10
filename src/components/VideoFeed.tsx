"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Camera, CameraOff, VideoIcon } from "lucide-react";

interface VideoFeedProps {
  onCameraStateChange?: (isCameraOn: boolean) => void;
  isCameraActiveProp?: boolean;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onCameraStateChange, isCameraActiveProp }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
      setIsCameraOn(true);
      setError(null);
      if (onCameraStateChange) onCameraStateChange(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("Camera access was denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found. Please ensure a camera is connected and enabled.");
        } else {
          setError("Could not access camera. Please ensure it's not in use by another application.");
        }
      } else {
         setError("An unknown error occurred while accessing the camera.");
      }
      setIsCameraOn(false);
      if (onCameraStateChange) onCameraStateChange(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsCameraOn(false);
    if (onCameraStateChange) onCameraStateChange(false);
  };

  useEffect(() => {
    if (isCameraActiveProp === true && !isCameraOn) {
      startCamera();
    } else if (isCameraActiveProp === false && isCameraOn) {
      stopCamera();
    }
  }, [isCameraActiveProp]);


  useEffect(() => {
    // Cleanup: stop camera when component unmounts
    return () => {
      stopCamera();
    };
  }, [stream]);

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-primary flex items-center">
          <VideoIcon className="mr-2 h-5 w-5 text-accent" />
          Live Camera Feed
        </CardTitle>
        <Button onClick={toggleCamera} variant="outline" size="sm">
          {isCameraOn ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
          {isCameraOn ? "Stop Camera" : "Start Camera"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Camera Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="aspect-video bg-secondary rounded-md overflow-hidden flex items-center justify-center">
          {isCameraOn ? (
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-muted-foreground p-4">
              <CameraOff className="h-16 w-16 mx-auto mb-2 text-primary opacity-50" />
              <p>Camera is off or not accessible.</p>
              {!error && <p className="text-sm">Click "Start Camera" to begin.</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoFeed;
