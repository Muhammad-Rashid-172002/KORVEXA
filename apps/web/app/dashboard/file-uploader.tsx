'use client';
import { FILE_RULES } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Download, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type FileItem = { id: string; originalName: string; sizeBytes: number; status: string };
const PURPOSE = 'portfolio' as const;

const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;

export function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await api.GET('/v1/me/files', { params: { query: { limit: 10 } } });
    setFiles(data?.items ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { data: presign, error: presignError } = await api.POST('/v1/files/uploads', {
        body: {
          purpose: PURPOSE,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });
      if (!presign)
        throw new Error(
          (presignError as { error?: { message?: string } })?.error?.message ?? 'Upload rejected',
        );
      const put = await fetch(presign.upload.url, {
        method: 'PUT',
        headers: presign.upload.headers,
        body: file,
      });
      if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);
      const { error: completeError } = await api.POST('/v1/files/{id}/complete', {
        params: { path: { id: presign.file.id } },
      });
      if (completeError) throw new Error('Upload verification failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function download(id: string) {
    const { data } = await api.GET('/v1/me/files/{id}', { params: { path: { id } } });
    if (data?.downloadUrl) window.location.assign(data.downloadUrl);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        id="file-input"
        data-testid="file-input"
        accept={FILE_RULES[PURPOSE].mimeTypes.join(',')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Button asChild variant="secondary" disabled={busy}>
        <label htmlFor="file-input" className={busy ? 'pointer-events-none opacity-50' : ''}>
          <Upload size={16} aria-hidden /> {busy ? 'Uploading…' : 'Upload a file'}
        </label>
      </Button>
      <p className="text-xs text-muted">
        Images, PDF or MP4 · up to {FILE_RULES[PURPOSE].maxBytes / 1024 ** 2} MB
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      {files.length === 0 ? (
        <p className="text-sm text-muted">No files yet.</p>
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-md border border-border"
          data-testid="file-list"
        >
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate">{f.originalName}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                {formatSize(f.sizeBytes)}
                {f.status === 'clean' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Download ${f.originalName}`}
                    onClick={() => void download(f.id)}
                  >
                    <Download size={14} aria-hidden />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
