import React, { useState, useRef, useEffect } from 'react';
import Tooltip from './Tooltip';

interface AudioPlayerProps {
  audioUrl: string | null;
  onDelete: () => void;
  isRecording?: boolean;
  recordingDuration?: number;
  onStop?: () => void;
  isRecordingEnabled?: boolean;
}

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds === Infinity) {
    return '00:00';
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, onDelete, isRecording, recordingDuration = 0, onStop, isRecordingEnabled }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handlePlaybackEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if(audioRef.current) audioRef.current.currentTime = 0;
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handlePlaybackEnd);

    // If the src changes, reset and try to play if it was playing before
    if (isPlaying && audioUrl) {
      audio.play().catch(e => console.error("Audio play failed:", e));
    }

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handlePlaybackEnd);
    };
  }, [audioUrl, isPlaying]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => console.error("Audio play failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  if (isRecording) {
    const isActuallyRecording = isRecordingEnabled ?? true;
    return (
      <div className={`flex items-center gap-2 p-1 w-full max-w-lg bg-slate-900/50 rounded-lg border ${isActuallyRecording ? 'border-red-500/50 animate-recording-glow' : 'border-slate-700/50'}`}>
        <Tooltip content="Stop Listening">
          <button onClick={onStop} className="h-8 w-8 flex-shrink-0 bg-red-500 text-white rounded-lg flex items-center justify-center transition-colors hover:bg-red-600">
            <i className="fas fa-stop text-sm"></i>
          </button>
        </Tooltip>

        <span className={`text-xs font-roboto-mono ${isActuallyRecording ? 'text-red-400' : 'text-slate-400'}`}>{formatTime(recordingDuration)}</span>
        
        <div className="relative w-full h-1.5 bg-slate-700 rounded-lg flex items-center">
            {isActuallyRecording ? (
              <div className="absolute inset-0 bg-red-500/30 rounded-lg animate-pulse"></div>
            ) : (
              <div className="w-full h-full bg-slate-500/30 rounded-lg"></div>
            )}
        </div>

        {isActuallyRecording ? (
            <span className="text-xs font-roboto-mono text-red-400 font-bold animate-pulse">LIVE</span>
        ) : (
            <Tooltip content="Audio is not being recorded">
              <span className="text-xs font-roboto-mono text-yellow-400 font-bold">NO REC</span>
            </Tooltip>
        )}
      </div>
    );
  }

  if (!audioUrl) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-1 w-full max-w-lg bg-slate-900/50 rounded-lg border border-slate-700/50">
      <audio ref={audioRef} src={audioUrl} preload="metadata"></audio>

      <Tooltip content={isPlaying ? "Pause" : "Play"}>
        <button onClick={togglePlayPause} className="h-8 w-8 flex-shrink-0 cosmo-button rounded-lg flex items-center justify-center">
          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
        </button>
      </Tooltip>

      <span className="text-xs font-roboto-mono text-slate-400">{formatTime(currentTime)}</span>

      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
        aria-label="Seek audio"
      />
      
      <span className="text-xs font-roboto-mono text-slate-400">{formatTime(duration)}</span>

      <div className="flex items-center gap-1 group">
        <Tooltip content="Volume">
          <i className="fas fa-volume-up text-slate-400 w-4 text-center"></i>
        </Tooltip>
        <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="custom-volume-slider w-12 group-hover:w-24 appearance-none bg-transparent cursor-pointer transition-all duration-300"
            aria-label="Volume control"
        />
      </div>

      <a href={audioUrl} download={`DefScribe-Recording-${new Date().toISOString()}.webm`}>
        <Tooltip content="Save Recording">
          <button className="h-8 w-8 flex-shrink-0 cosmo-button rounded-lg flex items-center justify-center">
            <i className="fas fa-save text-sm"></i>
          </button>
        </Tooltip>
      </a>
      <Tooltip content="Delete Recording">
        <button onClick={onDelete} className="h-8 w-8 flex-shrink-0 cosmo-button rounded-lg flex items-center justify-center hover:bg-red-500/50 hover:border-red-500">
          <i className="fas fa-trash text-sm"></i>
        </button>
      </Tooltip>
    </div>
  );
};

export default AudioPlayer;