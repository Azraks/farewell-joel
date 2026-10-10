import { errorMessage } from './ui';
import { callApi, deletionLink, type Credential } from './submission';
import { isLive } from './environment';
import { site } from '../config';

export function showDeletionReceipt(credential: Credential, submitted: boolean): void {
  const receipt = document.querySelector<HTMLElement>('#submissionReceipt')!;
  const input = receipt.querySelector<HTMLInputElement>('#deleteLink')!;
  input.value = deletionLink(credential);
  receipt.hidden = false;
  receipt.querySelector('#receiptTitle')!.textContent = submitted ? 'Save your private deletion link' : 'Your upload is not yet confirmed';
  receipt.querySelector('#receiptHelp')!.textContent = submitted
    ? 'Keep this link private. Anyone with it can delete your message and attachments.'
    : 'Retry to resume this attempt, or withdraw it before starting again. Save this link in case you close the page.';
  const contact = receipt.querySelector<HTMLElement>('#receiptContact')!;
  contact.hidden = !submitted;
  contact.replaceChildren();
  if (submitted) {
    const name = document.createElement('strong');
    name.textContent = site.organiser.name;
    const email = document.createElement('a');
    email.href = `mailto:${site.organiser.email}?subject=${encodeURIComponent('Farewell message update')}`;
    email.textContent = site.organiser.email;
    email.className = 'receipt-contact-email';
    contact.append('To update your message or attachments, or if you lose your deletion link, contact ', name, ' at ', email, '.');
  }
  document.querySelector<HTMLElement>('#withdrawAttempt')!.hidden = submitted;
  if (submitted) receipt.focus();
}

export function setupReceiptCopy(): void {
  document.querySelector('#copyDeleteLink')!.addEventListener('click', async () => {
    const input = document.querySelector<HTMLInputElement>('#deleteLink')!;
    const status = document.querySelector('#copyLinkStatus')!;
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = 'Copied. Save this link somewhere private.';
    } catch {
      input.focus();
      input.select();
      status.textContent = 'Select and copy the link above.';
    }
  });
}

export async function showDeletionView(credential: Credential): Promise<void> {
  document.querySelectorAll<HTMLElement>('header, main, footer, #stars, .nebula, .cursor-glow').forEach((element) => { element.hidden = true; });
  const panel = document.querySelector<HTMLElement>('#deletionView')!;
  const status = panel.querySelector<HTMLElement>('#deletionStatus')!;
  const button = panel.querySelector<HTMLButtonElement>('#confirmDeletion')!;
  const home = panel.querySelector<HTMLAnchorElement>('#backToSite')!;
  home.href = window.location.pathname;
  panel.hidden = false;
  button.hidden = true;
  button.disabled = false;
  panel.focus();
  document.title = 'Withdraw your farewell message';
  status.textContent = 'Checking your private link…';
  try {
    const result = await callApi('inspect', credential);
    if (result.status === 'unavailable') {
      status.textContent = 'This message has already been deleted, or the link is invalid. Contact the organiser if you need help.';
      return;
    }
    status.textContent = isLive
      ? 'Withdraw this message and all attached photos and videos? This cannot be undone.'
      : 'Demo mode: this link will simulate deletion. No saved message will be changed.';
    button.hidden = false;
  } catch (error) {
    status.textContent = `${errorMessage(error)} Reopen your saved deletion link to try again.`;
    return;
  }
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = 'Withdrawing your message…';
    try {
      const result = await callApi('delete', credential);
      button.hidden = true;
      status.textContent = result.status === 'deleted'
        ? (isLive ? 'Your message has been withdrawn. Attachment cleanup is queued if it could not finish immediately.' : 'Demo deletion complete. No real submission was removed.')
        : 'This message has already been deleted, or the link is invalid.';
    } catch (error) {
      status.textContent = `${errorMessage(error)} You can safely retry.`;
      button.disabled = false;
    }
  };
}
