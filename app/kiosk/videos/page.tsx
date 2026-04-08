/**
 * @file app/kiosk/videos/page.tsx
 * @description Kiosk required-video viewing page.
 *   Loads active videos from /api/videos, tracks completion via /api/kiosk/video-watched,
 *   and auto-advances to /kiosk/consent once all videos are marked watched.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Video {
  id: string;
  title: string;
  description?: string;
  url: string;
  isActive: boolean;
}

interface Patient {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export default function KioskVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('kiosk_patient') || '';
    if (raw) {
      try {
        const parsed = raw.startsWith('{') ? JSON.parse(raw) : { id: raw, name: raw };
        setPatient(parsed);
      } catch { /* ignore parse error */ }
    }

    // Get patient ID
    const currentPatientId = raw.startsWith('{') ? (() => { try { return JSON.parse(raw).id } catch { return '' } })() : raw;

    // Only restore sessionStorage watched state if same patient
    const savedPatientId = sessionStorage.getItem('kiosk_watched_for_patient');
    if (savedPatientId && savedPatientId === currentPatientId) {
      const savedWatched = sessionStorage.getItem('kiosk_watched_ids');
      if (savedWatched) {
        try { setWatched(new Set(JSON.parse(savedWatched))); } catch {}
      }
    } else {
      sessionStorage.removeItem('kiosk_watched_ids');
      sessionStorage.removeItem('kiosk_videos_watched');
    }

    const dbPatientId = currentPatientId

    fetch('/api/videos?active=true')
      .then(r => r.json())
      .then(async data => {
        const list: Video[] = Array.isArray(data) ? data : (data.videos ?? []);
        const activeVideos = list.filter((v: Video) => v.isActive !== false);
        setVideos(activeVideos);

        // Check DB for already-watched videos this session
        if (dbPatientId && activeVideos.length > 0) {
          try {
            const watchRes = await fetch(`/api/kiosk/videos-watched?patientId=${dbPatientId}`);
            if (watchRes.ok) {
              const watchData = await watchRes.json();
              const watchedIds: string[] = watchData.watchedIds ?? [];
              if (watchedIds.length > 0) {
                const watchedSet = new Set(watchedIds);
                setWatched(watchedSet);
                sessionStorage.setItem('kiosk_watched_ids', JSON.stringify(watchedIds));
                sessionStorage.setItem('kiosk_watched_for_patient', dbPatientId);
                sessionStorage.setItem('kiosk_videos_watched', String(watchedIds.length));
                // (routing handled at verify step — no redirect needed here)
              }
            }
          } catch { /* non-blocking */ }
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load videos. Please see a staff member.');
        setLoading(false);
      });
  }, []);

  async function markWatched(videoId: string) {
    setMarking(videoId);
    try {
      await fetch('/api/kiosk/video-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient?.id, videoId, completed: true }),
      });
    } catch {
      // Non-blocking — still mark locally
    } finally {
      setWatched(prev => {
        const next = new Set([...prev, videoId]);
        // Persist watched IDs tied to this patient
        if (patient?.id) sessionStorage.setItem('kiosk_watched_for_patient', patient.id);
        sessionStorage.setItem('kiosk_watched_ids', JSON.stringify([...next]));
        sessionStorage.setItem('kiosk_videos_watched', String(next.size));
        return next;
      });
      setMarking(null);
    }
  }

  const allWatched = videos.length > 0 && videos.every(v => watched.has(v.id));

  // Auto-proceed only if videos were watched in this session (patient is set)
  useEffect(() => {
    if (allWatched && !loading && patient?.id) {
      const timer = setTimeout(() => router.push('/kiosk/consent'), 1500);
      return () => clearTimeout(timer);
    }
  }, [allWatched, loading, patient, router]);
  const watchedCount = watched.size;

  function getEmbedUrl(url: string): string | null {
    // YouTube
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 24, color: '#64748b' }}>Loading videos…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.10)', padding: '48px 56px', maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <p style={{ fontSize: 20, color: '#dc2626' }}>{error}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.10)', padding: '48px 56px', maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0d9488', marginBottom: 16 }}>No Videos Required</h1>
        <p style={{ fontSize: 18, color: '#475569', marginBottom: 32 }}>You&apos;re all set! Proceed to check-in.</p>
        <button
          onClick={() => router.push('/kiosk/consent')}
          style={{ padding: '22px 48px', fontSize: 22, fontWeight: 700, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', minHeight: 70 }}
        >
          Continue to Check-In →
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, width: '100%' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {patient?.name && (
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0d9488', marginBottom: 8, background: '#e8f9f7', display: 'inline-block', padding: '4px 16px', borderRadius: 999 }}>
            👤 {patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(' ')}
          </div>
        )}
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0055A5', marginBottom: 10 }}>
          Before Your Appointment
        </h1>
        <p style={{ fontSize: 18, color: '#475569', marginBottom: 16 }}>
          Please watch the following video{videos.length > 1 ? 's' : ''} before checking in.
        </p>
        {/* Progress */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          background: watchedCount === videos.length ? '#d1fae5' : '#f0f9ff',
          border: `2px solid ${watchedCount === videos.length ? '#6ee7b7' : '#bfdbfe'}`,
          borderRadius: 50,
          padding: '10px 24px',
          fontSize: 18,
          fontWeight: 700,
          color: watchedCount === videos.length ? '#065f46' : '#0055A5',
        }}>
          {watchedCount === videos.length ? '✅' : '▶️'}
          {watchedCount} of {videos.length} watched
        </div>
      </div>

      {/* Video cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        {videos.map((video, idx) => {
          const isWatched = watched.has(video.id);
          const embedUrl = getEmbedUrl(video.url);

          return (
            <div key={video.id} style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: isWatched ? '2px solid #6ee7b7' : '2px solid #e2e8f0',
              overflow: 'hidden',
              transition: 'border-color 0.3s',
            }}>
              {/* Card header */}
              <div style={{
                background: isWatched ? '#d1fae5' : '#f8fafc',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderBottom: '1px solid #e2e8f0',
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: isWatched ? '#059669' : '#0055A5',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {isWatched ? '✓' : idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{video.title}</div>
                  {video.description && (
                    <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{video.description}</div>
                  )}
                </div>
                {isWatched && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>WATCHED</div>
                )}
              </div>

              {/* Video player */}
              <div style={{ padding: '20px 24px' }}>
                {embedUrl ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                      <iframe
                        src={`${embedUrl}&autoplay=0&rel=0&modestbranding=1`}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        title={video.title}
                      />
                    </div>
                    {/* Fallback link if embed fails */}
                    <a href={video.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 13, color: '#64748b', textDecoration: 'underline' }}>
                      Video not loading? Click here to open in new tab ↗
                    </a>
                  </div>
                ) : (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '16px 28px',
                      fontSize: 18,
                      fontWeight: 600,
                      background: '#0055A5',
                      color: '#fff',
                      borderRadius: 12,
                      textDecoration: 'none',
                      marginBottom: 16,
                      minHeight: 60,
                    }}
                  >
                    ▶ Watch Video
                  </a>
                )}

                {!isWatched && (
                  <button
                    onClick={() => markWatched(video.id)}
                    disabled={marking === video.id}
                    style={{
                      width: '100%',
                      padding: '18px 0',
                      fontSize: 18,
                      fontWeight: 700,
                      background: marking === video.id ? '#94a3b8' : '#0d9488',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      cursor: marking === video.id ? 'not-allowed' : 'pointer',
                      minHeight: 60,
                      transition: 'background 0.2s',
                    }}
                  >
                    {marking === video.id ? 'Saving…' : '✅ I watched this video'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      {allWatched && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => router.push('/kiosk/consent')}
            style={{
              padding: '22px 56px',
              fontSize: 24,
              fontWeight: 700,
              background: '#0d9488',
              color: '#fff',
              border: 'none',
              borderRadius: 16,
              cursor: 'pointer',
              minHeight: 70,
              boxShadow: '0 4px 20px rgba(13,148,136,0.3)',
              animation: 'pulse 2s infinite',
            }}
          >
            Continue to Check-In Complete →
          </button>
          <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 4px 20px rgba(13,148,136,0.3); } 50% { box-shadow: 0 4px 32px rgba(13,148,136,0.55); } }`}</style>
        </div>
      )}
    </div>
  );
}

