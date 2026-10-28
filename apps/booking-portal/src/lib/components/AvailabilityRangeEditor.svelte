<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { showToast } from '$lib/toast.svelte';
	import { dayLabel, formatTime } from '$lib/utils/format';
	import { isNetworkFailure, NETWORK_ERROR_MESSAGE } from '$lib/utils/forms';
	import {
		EDITOR_WEEKDAYS,
		TIME_OPTIONS,
		WEEKDAY_LABELS,
		conflictingBookings,
		nextRange,
		placeBookings,
		rangeErrors,
		rangesToWindows,
		shortWindows,
		windowsToCells,
		windowsToRanges,
		type TimeRange,
		type WeeklyWindow
	} from '$lib/utils/availabilityEditor';

	type UpcomingBooking = {
		id: string;
		clientName: string;
		startsAt: Date;
		durationMin: number;
		status: string;
	};

	let {
		windows,
		upcoming,
		zone,
		minSessionLength,
		onCancel,
		onSaved,
		saveAction = '/trainer/availability?/saveHours',
		preview,
		draft = $bindable()
	}: {
		windows: WeeklyWindow[];
		upcoming: UpcomingBooking[];
		zone: string;
		minSessionLength: number | null;
		/** Called after cancel has reset the edits — e.g. to close the editor. */
		onCancel?: () => void;
		onSaved?: () => void;
		/** Where the save form posts. */
		saveAction?: string;
		/** Shown between the day rows and the save bar, so the coach reviews before saving. */
		preview?: Snippet;
		/** The windows this edit would save. */
		draft?: WeeklyWindow[];
	} = $props();

	const WEEKDAY_SET = [1, 2, 3, 4, 5];
	const clone = (days: TimeRange[][]) => days.map((day) => day.map((r) => ({ ...r })));

	// Snapshot of what's saved when the editor opens; edits are compared against it.
	const original = untrack(() => windowsToRanges(windows));
	const originalWindows = rangesToWindows(original);
	let ranges = $state(clone(original));
	// A closed day remembers its hours, so reopening it puts them back.
	const closedHours: TimeRange[][] = Array.from({ length: 7 }, () => []);

	const draftWindows = $derived(rangesToWindows(ranges));
	$effect(() => {
		draft = draftWindows;
	});

	const errors = $derived(ranges.map(rangeErrors));
	const hasErrors = $derived(errors.some((day) => day.some(Boolean)));

	const dayKey = (list: WeeklyWindow[], weekday: number) =>
		list
			.filter((w) => w.weekday === weekday)
			.map((w) => `${w.startMin}-${w.endMin}`)
			.join(',');
	const changedDays = $derived(
		EDITOR_WEEKDAYS.filter((w) => dayKey(originalWindows, w) !== dayKey(draftWindows, w))
	);

	const placed = $derived(placeBookings(upcoming, zone));
	const conflicts = $derived(
		conflictingBookings(placed, windowsToCells(originalWindows), windowsToCells(draftWindows))
	);
	const short = $derived(shortWindows(draftWindows, minSessionLength));
	const isShort = (weekday: number, r: TimeRange) =>
		short.some((w) => w.weekday === weekday && w.startMin <= r.startMin && r.endMin <= w.endMin);

	const setOpen = (weekday: number, open: boolean) => {
		if (open) {
			ranges[weekday] = closedHours[weekday].length > 0 ? closedHours[weekday] : [nextRange([])];
		} else {
			closedHours[weekday] = ranges[weekday];
			ranges[weekday] = [];
		}
	};
	const addRange = (weekday: number) => ranges[weekday].push(nextRange(ranges[weekday]));
	const removeRange = (weekday: number, i: number) => ranges[weekday].splice(i, 1);

	let copyingFrom = $state<number | null>(null);
	let copyTargets = $state<number[]>([]);
	const startCopy = (weekday: number) => {
		copyingFrom = weekday;
		copyTargets = [];
	};
	const toggleTarget = (weekday: number) =>
		(copyTargets = copyTargets.includes(weekday)
			? copyTargets.filter((w) => w !== weekday)
			: [...copyTargets, weekday]);
	const applyCopy = () => {
		if (copyingFrom === null) return;
		for (const target of copyTargets) ranges[target] = ranges[copyingFrom].map((r) => ({ ...r }));
		copyingFrom = null;
	};

	const cancel = () => {
		ranges = clone(original);
		onCancel?.();
	};

	const dirty = $derived(changedDays.length > 0);
	let saving = $state(false);
	// Set once saved or discarded, so leaving afterwards isn't stopped.
	let saved = false;
	let saveError = $state<string | null>(null);
	let saveForm = $state<HTMLFormElement>();
	let confirmDialog = $state<HTMLDialogElement>();

	// Sessions in hours being closed need an explicit "save anyway"; otherwise save straight away.
	const requestSave = () => {
		if (conflicts.length > 0) confirmDialog?.showModal();
		else saveForm?.requestSubmit();
	};

	const enhanceSave: SubmitFunction = () => {
		saving = true;
		saveError = null;
		return async ({ result }) => {
			if (isNetworkFailure(result)) saveError = NETWORK_ERROR_MESSAGE;
			else if (result.type === 'failure') saveError = String(result.data?.message ?? 'something went wrong');
			else if (result.type === 'error') saveError = 'something went wrong — please try again';
			else {
				showToast('weekly hours saved');
				await invalidateAll();
				saved = true;
				onSaved?.();
			}
			saving = false;
			confirmDialog?.close();
		};
	};

	// Unsaved changes: closing/reloading the tab gets the browser's own prompt;
	// navigating within the app asks here first.
	let leaveDialog = $state<HTMLDialogElement>();
	let pendingLeave: URL | null = null;
	beforeNavigate(({ cancel, to, type }) => {
		if (!dirty || saved || saving) return;
		cancel();
		if (type === 'leave' || !to) return;
		pendingLeave = to.url;
		leaveDialog?.showModal();
	});
	const discardAndLeave = () => {
		saved = true;
		leaveDialog?.close();
		if (pendingLeave) goto(pendingLeave);
	};

	const START_OPTIONS = TIME_OPTIONS.slice(0, -1);
	const END_OPTIONS = TIME_OPTIONS.slice(1);
</script>

<div class="flex flex-col gap-4">
	<p class="text-base-content/60 text-sm">
		set the hours you're open each week. changes apply to every week once saved.
	</p>

	<div class="grid grid-cols-1 gap-6 xl:min-h-96 xl:grid-cols-[22rem_minmax(0,1fr)]">
		<!-- On wide screens the preview sets the row's height and the days scroll inside it. -->
		<div class="relative">
			<div
				class="border-base-300 divide-base-300 flex flex-col divide-y rounded-field border xl:absolute xl:inset-0 xl:overflow-y-auto"
			>
				{#each EDITOR_WEEKDAYS as weekday (weekday)}
					{@const open = ranges[weekday].length > 0}
					{@const dayConflicts = conflicts.filter((c) => c.weekday === weekday)}
					<div class="flex flex-col gap-2 p-3">
						<div class="flex items-center justify-between gap-2">
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-success"
									checked={open}
									onchange={(e) => setOpen(weekday, e.currentTarget.checked)}
								/>
								<span class="font-medium">{WEEKDAY_LABELS[weekday]}</span>
								{#if !open}
									<span class="text-base-content/50 text-sm">closed</span>
								{/if}
							</label>
							{#if open}
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => startCopy(weekday)}>
									copy to…
								</button>
							{/if}
						</div>

						{#if open}
							<!-- Indented to line up with the day name (toggle width + gap). -->
							<div class="flex flex-col gap-2 pl-11">
								{#each ranges[weekday] as range, i (i)}
									{@const error = errors[weekday][i]}
									<div class="flex flex-col gap-1">
										<div class="flex items-center gap-2">
											<select
												class="select select-sm w-24"
												aria-label="{WEEKDAY_LABELS[weekday]} start"
												value={range.startMin}
												onchange={(e) => (range.startMin = Number(e.currentTarget.value))}
											>
												{#each START_OPTIONS as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
											<span class="text-base-content/50">–</span>
											<select
												class="select select-sm w-24"
												aria-label="{WEEKDAY_LABELS[weekday]} end"
												value={range.endMin}
												onchange={(e) => (range.endMin = Number(e.currentTarget.value))}
											>
												{#each END_OPTIONS as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
											<button
												type="button"
												class="btn btn-ghost btn-sm btn-square"
												aria-label="remove these hours"
												onclick={() => removeRange(weekday, i)}
											>
												✕
											</button>
										</div>
										{#if error}
											<span class="text-error text-xs">{error}</span>
										{:else if isShort(weekday, range)}
											<span class="text-base-content/70 flex items-center gap-1.5 text-xs">
												<span class="badge badge-xs badge-warning font-body">too short</span>
												only a free consult fits — your packages are {minSessionLength} min
											</span>
										{/if}
									</div>
								{/each}

								<button
									type="button"
									class="btn btn-ghost btn-xs self-start"
									onclick={() => addRange(weekday)}
								>
									+ add hours
								</button>
							</div>
						{/if}

						{#if copyingFrom === weekday}
							<div class="bg-base-200 flex flex-col gap-2 rounded-field p-3 text-sm">
								<span class="text-base-content/70">copy {WEEKDAY_LABELS[weekday]}'s hours to:</span>
								<div class="flex flex-wrap gap-2">
									{#each EDITOR_WEEKDAYS.filter((w) => w !== weekday) as target (target)}
										<button
											type="button"
											class="btn btn-xs rounded-full font-normal {copyTargets.includes(target)
												? 'btn-neutral'
												: 'border-base-300 bg-base-100 text-base-content/70'}"
											onclick={() => toggleTarget(target)}
										>
											{WEEKDAY_LABELS[target]}
										</button>
									{/each}
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={() => (copyTargets = WEEKDAY_SET.filter((w) => w !== weekday))}
									>
										all weekdays
									</button>
								</div>
								<div class="flex gap-2">
									<button
										type="button"
										class="btn btn-accent btn-xs"
										disabled={copyTargets.length === 0}
										onclick={applyCopy}
									>
										copy
									</button>
									<button type="button" class="btn btn-ghost btn-xs" onclick={() => (copyingFrom = null)}>
										cancel
									</button>
								</div>
							</div>
						{/if}

						{#if dayConflicts.length > 0}
							<div class="border-error bg-error/10 flex flex-col gap-1 rounded-field border p-2 text-xs">
								<span class="font-medium">
									{dayConflicts.length === 1 ? 'a session falls' : `${dayConflicts.length} sessions fall`} in hours
									you're closing — {dayConflicts.length === 1 ? 'it stays' : 'they stay'} booked:
								</span>
								{#each dayConflicts as { booking } (booking.id)}
									<span>
										{booking.clientName} · {dayLabel(booking.startsAt, zone)} at {formatTime(booking.startsAt, zone)} ·
										{booking.status === 'confirmed' ? 'booked' : 'requested'}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if preview}
			<div class="min-w-0">
				{@render preview()}
			</div>
		{/if}
	</div>

	<form
		bind:this={saveForm}
		method="POST"
		action={saveAction}
		class="flex flex-wrap items-center justify-between gap-3"
		use:enhance={enhanceSave}
	>
		<input type="hidden" name="windows" value={JSON.stringify(draftWindows)} />
		<span class="text-base-content/60 text-sm">
			{#if saveError}
				<span class="text-error">{saveError}</span>
			{:else if hasErrors}
				<span class="text-error">fix the hours marked above to save</span>
			{:else if !dirty}
				no changes yet
			{:else}
				unsaved changes to {changedDays.map((w) => WEEKDAY_LABELS[w]).join(', ')}
			{/if}
			{#if conflicts.length > 0}
				<span class="text-error">
					· {conflicts.length} {conflicts.length === 1 ? 'session' : 'sessions'} affected
				</span>
			{/if}
		</span>
		<div class="flex gap-2">
			<button type="button" class="btn btn-sm btn-ghost" disabled={saving} onclick={cancel}>cancel</button>
			<button
				type="button"
				class="btn btn-sm btn-accent"
				disabled={!dirty || hasErrors || saving}
				onclick={requestSave}
			>
				{saving ? 'saving…' : 'save'}
			</button>
		</div>
	</form>
</div>

<dialog bind:this={confirmDialog} class="modal">
	<div class="modal-box bg-base-100 flex flex-col gap-4 rounded-2xl">
		<h3 class="font-headings text-xl">save your new hours?</h3>
		<p class="text-base-content/70 text-sm">
			{conflicts.length === 1 ? 'this session falls' : `these ${conflicts.length} sessions fall`} in hours you're
			closing:
		</p>
		<ul class="bg-base-200 border-base-300 divide-base-300 divide-y rounded-field border text-sm">
			{#each conflicts as { booking } (booking.id)}
				<li class="flex items-center justify-between gap-3 px-4 py-2.5">
					<span>
						{booking.clientName} · {dayLabel(booking.startsAt, zone)} at {formatTime(booking.startsAt, zone)}
					</span>
					<span class="badge badge-sm font-body {booking.status === 'confirmed' ? 'badge-success' : 'badge-warning'}">
						{booking.status === 'confirmed' ? 'booked' : 'requested'}
					</span>
				</li>
			{/each}
		</ul>
		<p class="text-base-content/70 text-sm">
			{conflicts.length === 1 ? 'it stays' : 'they stay'} as {conflicts.length === 1 ? 'it is' : 'they are'} —
			closing hours only stops new bookings. reschedule or decline them separately if you can't make them.
		</p>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-sm btn-ghost" disabled={saving} onclick={() => confirmDialog?.close()}>
				keep editing
			</button>
			<button type="button" class="btn btn-sm btn-accent" disabled={saving} onclick={() => saveForm?.requestSubmit()}>
				{saving ? 'saving…' : 'save anyway'}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="close">close</button>
	</form>
</dialog>

<dialog bind:this={leaveDialog} class="modal">
	<div class="modal-box bg-base-100 flex flex-col gap-4 rounded-2xl">
		<h3 class="font-headings text-xl">discard your changes?</h3>
		<p class="text-base-content/70 text-sm">
			you've changed your hours for {changedDays.map((w) => WEEKDAY_LABELS[w]).join(', ')} but haven't saved.
		</p>
		<div class="modal-action mt-0">
			<button type="button" class="btn btn-sm btn-ghost" onclick={() => leaveDialog?.close()}>keep editing</button>
			<button type="button" class="btn btn-sm btn-error" onclick={discardAndLeave}>discard and leave</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="close">close</button>
	</form>
</dialog>
