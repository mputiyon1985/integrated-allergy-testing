'use client';

import { useState, useEffect } from 'react';

interface VideoItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  category?: string;
  duration?: string;
  active?: boolean;
  createdAt?: string;
  order?: number;
}

const EMPTY_VIDEO_FORM = { title: '', url: '', description: '', category: '', duration: '' };

export default function VideosTab() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setVForm] = useState({ ...EMPTY_VIDEO_FORM });

  function setVField(field: string, value: string) { setVForm(prev => ({ ...prev, [field]: value })); }

  function loadVideos() {
    setLoading(true);
    fetch('/api/videos').then(r => r.ok ? r.json() : []).then(d => setVideos(Array.isArray(d) ? d : (d.videos ?? []))).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { loadVideos(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, url: form.url || undefined, description: form.description || undefined, category: form.category || undefined, duration: form.duration || undefined }) });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to add video');
      setSuccess('Video added successfully!'); setVForm({ ...EMPTY_VIDEO_FORM }); setShowForm(false); loadVideos();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to add video'); }
    finally { setSaving(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVideo) return;
    setSaving(true); setError('');
    try {
      const r = await fetch(`/api/videos/${editingVideo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, url: form.url || null, description: form.description || null, category: form.category || null, duration: form.duration || null }) });
      if (!r.ok) throw new Error('Failed to update video');
      setSuccess('Video updated!'); setEditingVideo(null); loadVideos();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to update'); }
    finally { setSaving(false); }
  }

  function openEdit(v: VideoItem) {
    setEditingVideo(v);
    setVForm({ title: v.title, url: v.url ?? '', description: v.description ?? '', category: v.category ?? '', duration: v.duration ?? '' });
  }

  const categories = [...new Set(videos.map(v => v.category).filter(Boolean))] as string[];

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>🎬 Video Library</div>
        <button className="btn" onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancel' : '+ Add Video'}</button>
      </div>
      {error && <div className="alert alert-error">⚠️ {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16 }}>✕</button></div>}
      {success && <div className="alert alert-success">✓ {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: 16 }}>✕</button></div>}
      {showForm && (
        <div className="card mb-6">
          <div className="card-title">Add New Video</div>
          <form onSubmit={handleAdd}>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Title <span className="required">*</span></label><input type="text" className="form-input" placeholder="Video title" value={form.title} onChange={e => setVField('title', e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Category</label><input type="text" className="form-input" placeholder="e.g. Allergy Education" value={form.category} onChange={e => setVField('category', e.target.value)} /></div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Video URL</label><input type="url" className="form-input" placeholder="https://..." value={form.url} onChange={e => setVField('url', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Duration</label><input type="text" className="form-input" placeholder="e.g. 5:30" value={form.duration} onChange={e => setVField('duration', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" placeholder="Brief description…" rows={3} value={form.description} onChange={e => setVField('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Video'}</button>
            </div>
          </form>
        </div>
      )}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading videos…</span></div>
      ) : videos.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🎬</div><div className="empty-state-title">No videos yet</div><div>Add instructional videos for patients to watch before testing.</div><div style={{ marginTop: 16 }}><button className="btn" onClick={() => setShowForm(true)}>Add First Video</button></div></div>
      ) : (
        <>
          {(categories.length > 0 ? categories : [undefined]).map(cat => {
            const catVideos = cat ? videos.filter(v => v.category === cat) : videos.filter(v => !v.category);
            if (catVideos.length === 0) return null;
            return (
              <div key={cat ?? 'uncategorized'} className="mb-6">
                {categories.length > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#0055A5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>{cat ?? 'Uncategorized'}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {catVideos.map(v => (
                    <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(135deg, #0055A5, #2EC4B6)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🎬</div>
                      <div style={{ padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#1a2233' }}>{v.title}</div>
                        {v.description && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>{v.description}</div>}
                        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                          {v.category && <span className="badge badge-blue">{v.category}</span>}
                          {v.duration && <span className="badge badge-gray">⏱ {v.duration}</span>}
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          {v.url ? <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>▶ Watch Video</a> : <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No URL set</span>}
                          <button onClick={() => openEdit(v)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
      {editingVideo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>✏️ Edit Video</h2>
              <button onClick={() => setEditingVideo(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Title *</label><input className="form-input" value={form.title} onChange={e => setVField('title', e.target.value)} required /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Video URL</label><input className="form-input" type="url" placeholder="https://www.youtube.com/watch?v=..." value={form.url} onChange={e => setVField('url', e.target.value)} /><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>YouTube, Vimeo, or any direct video URL</div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Category</label><input className="form-input" placeholder="what, how, why..." value={form.category} onChange={e => setVField('category', e.target.value)} /></div>
                  <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Duration</label><input className="form-input" placeholder="e.g. 5:30" value={form.duration} onChange={e => setVField('duration', e.target.value)} /></div>
                </div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Description</label><textarea className="form-input" rows={3} value={form.description} onChange={e => setVField('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditingVideo(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{saving ? '⏳ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
