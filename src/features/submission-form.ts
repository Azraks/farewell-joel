import { site } from '../config';
import { isLive, isTestSubmission } from '../lib/environment';
import { compressImage } from '../lib/media';
import { query, reducedMotion, toast, errorMessage } from '../lib/ui';
import {
  beginUpload, callApi, createUploadSession, finishUpload, uploadAttachment,
  MAX_PHOTOS, MAX_VIDEO_BYTES, MAX_PHOTO_BYTES, type UploadSession,
} from '../lib/submission';
import { showDeletionReceipt } from '../lib/deletion';
import { validateMessage, type MessageInput } from '../../supabase/functions/tribute-api/domain';
import { starBurst } from '../effects/celebrate';

interface SubmissionAttempt {
  session: UploadSession;
  files: Blob[];
  message: MessageInput;
}

function formatJst(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' JST';
}

function setupDeadline(form: HTMLFormElement): boolean {
  if (!site.submissionDeadline) return true;
  const end = new Date(site.submissionDeadline).getTime();
  if (Number.isNaN(end)) return true;
  const el = query('#deadline');
  el.hidden = false;
  if (Date.now() < end) {
    el.textContent = `⏳ Submissions close on ${formatJst(site.submissionDeadline)}`;
    return true;
  }
  el.textContent = '🌙 Submissions are now closed. Thank you to everyone who added a star!';
  form.hidden = true;
  return false;
}

export function setupForm(onSubmitted: () => Promise<void>) {
  const form = query<HTMLFormElement>('#form');
  if (!setupDeadline(form)) return;

  const messageInput = form.elements.namedItem('message') as HTMLTextAreaElement;
  const photoInput = form.elements.namedItem('photo') as HTMLInputElement;
  const videoInput = form.elements.namedItem('video') as HTMLInputElement;
  const linkInput = form.elements.namedItem('video_link') as HTMLInputElement;
  const previews = query('#photoPreviews');
  const errorElement = query('#formError');
  const submitButton = query<HTMLButtonElement>('#submitBtn');
  const progress = query('#progress');
  const progressBar = query('#progressBar');
  const progressText = query('#progressText');
  let videoMode: 'upload' | 'link' = 'upload';
  let photos: File[] = [];
  let previewUrls: string[] = [];
  let submitting = false;
  // Keep the same snapshot and credentials for retries after a lost response.
  let attempt: SubmissionAttempt | null = null;
  const controls = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button')];
  function setLocked(locked: boolean) {
    controls.forEach((control) => { control.disabled = locked; });
  }

  messageInput.addEventListener('input', () => (query('#charCount').textContent = String(messageInput.value.length)));

  const renderPreviews = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    previews.innerHTML = '';
    photos.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'photo-preview';
      const url = URL.createObjectURL(f);
      previewUrls.push(url);
      item.innerHTML = `<img src="${url}" alt="" /><button type="button" aria-label="Remove photo">×</button>`;
      item.querySelector('button')!.addEventListener('click', () => {
        if (submitting || attempt) return;
        photos.splice(i, 1);
        renderPreviews();
      });
      previews.appendChild(item);
    });
  };

  photoInput.addEventListener('change', () => {
    const picked = [...(photoInput.files ?? [])].filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    if (picked.length > room) toast(`You can attach up to ${MAX_PHOTOS} photos.`);
    photos = photos.concat(picked.slice(0, Math.max(0, room)));
    photoInput.value = ''; // allow re-selecting the same file
    renderPreviews();
  });

  videoInput.addEventListener('change', () => {
    const f = videoInput.files?.[0];
    query('#videoName').textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)} MB` : '';
    errorElement.textContent =
      f && f.size > MAX_VIDEO_BYTES
        ? 'This video is larger than 20 MB. Please trim it, or upload it to YouTube/Drive and paste the link instead.'
        : '';
  });

  form.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      videoMode = tab.dataset.tab as 'upload' | 'link';
      form.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      form.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== videoMode));
    }),
  );

  function setProgress(label: string, fraction: number) {
    const percent = Math.round(fraction * 100);
    progress.hidden = false;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${label} ${percent}%`;
  }

  const clearForm = () => {
    form.reset();
    photos = [];
    renderPreviews();
    query('#charCount').textContent = '0';
    query('#videoName').textContent = '';
    progress.hidden = true;
    setLocked(false);
  };

  query('#withdrawAttempt').addEventListener('click', async () => {
    if (!attempt || submitting) return;
    const button = query<HTMLButtonElement>('#withdrawAttempt');
    button.disabled = true;
    try {
      await callApi('delete', attempt.session);
      attempt = null;
      clearForm();
      query('#submissionReceipt').hidden = true;
      errorElement.textContent = '';
      submitButton.textContent = '✦ Send to the stars';
      toast('The attempt was withdrawn. You can start again.');
    } catch (error) {
      errorElement.textContent = errorMessage(error);
    } finally {
      button.disabled = false;
    }
  });

  async function prepareAttempt(selectedPhotos: File[], video: File | null, message: MessageInput): Promise<SubmissionAttempt> {
    const files: Blob[] = [];
    for (const [index, photo] of selectedPhotos.entries()) {
      setProgress(`Preparing photo ${index + 1}/${selectedPhotos.length}`, 0);
      const blob = await compressImage(photo);
      if (blob.size > MAX_PHOTO_BYTES) throw new Error('A compressed photo is still too large. Please choose a smaller photo.');
      files.push(blob);
    }
    if (video) files.push(video);
    const session = createUploadSession(files.map((file, index) => ({
      kind: index < selectedPhotos.length ? 'photo' : 'video', size: file.size, type: file.type,
    })));
    return { session, files, message };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    errorElement.textContent = '';
    if (!attempt && !setupDeadline(form)) return;
    const selectedPhotos = [...photos];
    const video = videoMode === 'upload' ? (videoInput.files?.[0] ?? null) : null;
    let message: MessageInput;
    if (!attempt) {
      const data = new FormData(form);
      try {
        message = validateMessage({
          name: data.get('name'),
          team: data.get('team'),
          message: data.get('message'),
          video_link: videoMode === 'link' ? linkInput.value : null,
          is_test: isTestSubmission,
        }, Boolean(video) || selectedPhotos.length > 0);
        if (video && video.size > MAX_VIDEO_BYTES) throw new Error('Video must be 20 MB or smaller.');
        if (video && !/^video\/(mp4|quicktime|webm)$/.test(video.type)) throw new Error('Please upload an MP4, MOV or WebM video.');
        if (!data.get('consent')) throw new Error('Please tick the consent box.');
        // A large source photo can exhaust mobile memory before it is compressed.
        if (selectedPhotos.some((file) => file.size > 20 * 1024 * 1024)) throw new Error('Please choose source photos smaller than 20 MB.');
        if (String(data.get('website') ?? '')) {
          clearForm();
          toast('Thank you! ✨');
          return;
        }
      } catch (error) {
        errorElement.textContent = errorMessage(error);
        return;
      }
    } else {
      message = attempt.message;
    }

    submitting = true;
    setLocked(true);
    query('#withdrawAttempt').setAttribute('disabled', '');
    submitButton.textContent = 'Launching…';
    try {
      if (!attempt) {
        attempt = await prepareAttempt(selectedPhotos, video, message);
        showDeletionReceipt(attempt.session, false);
      }
      const current = attempt;
      const alreadySubmitted = await beginUpload(current.session);
      if (!alreadySubmitted) {
        for (const [index, file] of current.files.entries()) {
          await uploadAttachment(current.session, index, file, (fraction) => setProgress(`Uploading attachment ${index + 1}/${current.files.length}`, fraction));
        }
        await finishUpload(current.session, current.message);
      }
      showDeletionReceipt(current.session, true);
      attempt = null;
      clearForm();
      if (!reducedMotion) starBurst();
      toast(isLive ? 'Your message has been published. Save your private deletion link below.' : 'Demo mode: submission simulated. Nothing has been saved.', 8000);
      if (isLive) await onSubmitted();
    } catch (error) {
      errorElement.textContent = `${errorMessage(error)}${attempt ? ' Your files and private link are kept on this page; retry or withdraw this attempt.' : ''}`;
      progress.hidden = true;
      if (!attempt) setLocked(false);
    } finally {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = attempt ? 'Retry this submission' : '✦ Send to the stars';
      query('#withdrawAttempt').removeAttribute('disabled');
    }
  });
}
