<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { showToast } from '$lib/toast.svelte';
	import { zonedDateParts } from '$lib/utils/availability';
	import { dayLabel, formatTime } from '$lib/utils/format';
	import { isNetworkFailure, NETWORK_ERROR_MESSAGE } from '$lib/utils/forms';
	import {
		ALL_DAY,
		EDITOR_WEEKDAYS,
		ONE_OFF_PREVIEW_COUNT,
		TIME_OPTIONS,
		WEEKDAY_LABELS,
		countOneOffChanges,
		nextRange,
		oneOffDatesLabel,
		oneOffTimesLabel,
		rangeErrors,
		rangesToWindows,
		redundantOneOffReason,
		sessionsLosingHours,
		shortWindows,
		windowsToRanges,
		type OneOffChange,
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
		oneOffs,
		today,
		upcoming,
		zone,
		minSessionLength,
		onCancel,
		onSaved,
		saveAction = '/trainer/availability?/saveHours',
		preview,
		draft = $bindable(),
		draftOneOffs = $bindable()
	}: {
		windows: WeeklyWindow[];
		/** Upcoming one-off changes (time off / extra hours). */
		oneOffs: OneOffChange[];
		/** The coach's date, `YYYY-MM-DD` — one-off changes can't start before it. */
		today: string;
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
		/** The one-off changes this edit would save. */
		draftOneOffs?: OneOffChange[];
	} = $props();

	const WEEKDAY_SET = [1, 2, 3, 4, 5];
	const clone = (days: TimeRange[][]) => days.map((day) => day.map((r) => ({ ...r })));

	// Snapshot of what's saved when the editor opens; edits are compared against it.
	const original = untrack(() => windowsToRanges(windows));
	const originalWindows = rangesToWindows(original);
	let ranges = $state(clone(original));
	// A closed day remembers its hours, so reopening it puts them back.
	const closedHours: TimeRange[][] = Array.from({ length: 7 }, () => []);

	const cloneOneOffs = (list: OneOffChange[]) => list.map((o) => ({ ...o }));
	const originalOneOffs = untrack(() => cloneOneOffs(oneOffs));
	let entries = $state(cloneOneOffs(originalOneOffs));

	const draftWindows = $derived(rangesToWindows(ranges));
	$effect(() => {
		draft = draftWindows;
		draftOneOffs = entries;
	});

	const errors = $derived(ranges.map(rangeErrors));

	const dayKey = (list: WeeklyWindow[], weekday: number) =>
		list
			.filter((w) => w.weekday === weekday)
			.map((w) => `${w.startMin}-${w.endMin}`)
			.join(',');
	const changedDays = $derived(
		EDITOR_WEEKDAYS.filter((w) => dayKey(originalWindows, w) !== dayKey(draftWindows, w))
	);

	// Sessions whose own date and time stop being open hours. Ones caused by a
	// weekly change are shown under that day; the rest under one-off changes.
	const before = { windows: originalWindows, oneOffs: originalOneOffs };
	const conflicts = $derived(
		sessionsLosingHours(upcoming, before, { windows: draftWindows, oneOffs: entries }, zone)
	);
	const weeklyConflicts = $derived(
		sessionsLosingHours(upcoming, before, { windows: draftWindows, oneOffs: originalOneOffs }, zone)
	);
	const conflictsOn = (weekday: number) =>
		conflicts.filter(
			(c) => weeklyConflicts.includes(c) && zonedDateParts(c.startsAt, zone).weekday === weekday
		);
	const oneOffConflicts = $derived(conflicts.filter((c) => !weeklyConflicts.includes(c)));
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

	const oneOffChanges = $derived(countOneOffChanges(originalOneOffs, entries));
	// An entry can stop changing anything after a weekly edit (e.g. extra sunday
	// hours once sundays open every week). The server refuses those, so flag them here.
	const entryErrors = $derived(
		entries.map((e, i) =>
			redundantOneOffReason(e, draftWindows, entries.filter((_, j) => j !== i))
		)
	);
	const hasErrors = $derived(
		errors.some((day) => day.some(Boolean)) || entryErrors.some(Boolean)
	);
	let showAllEntries = $state(false);
	const visibleEntries = $derived(
		showAllEntries || entryErrors.some((e, i) => e && i >= ONE_OFF_PREVIEW_COUNT)
			? entries
			: entries.slice(0, ONE_OFF_PREVIEW_COUNT)
	);

	// Adding a one-off change: time off defaults to the whole day, extra hours to a morning.
	let adding = $state(false);
	let newKind = $state<'closed' | 'open'>('closed');
	let newStart = $state('');
	let newEnd = $state('');
	let newAllDay = $state(true);
	let newFrom = $state(9 * 60);
	let newTo = $state(12 * 60);
	let newNote = $state('');

	const startAdding = () => {
		newKind = 'closed';
		newStart = today;
		newEnd = '';
		newAllDay = true;
		newFrom = 9 * 60;
		newTo = 12 * 60;
		newNote = '';
		adding = true;
	};
	const setKind = (kind: 'closed' | 'open') => {
		newKind = kind;
		newAllDay = kind === 'closed';
	};
	const newEntry = $derived<OneOffChange>({
		kind: newKind,
		startDate: newStart,
		endDate: newEnd || newStart,
		...(newAllDay ? ALL_DAY : { startMin: newFrom, endMin: newTo }),
		note: newNote.trim() || null
	});
	const addError = $derived(
		!newStart
			? 'pick a date'
			: newStart < today
				? 'pick today or later'
				: newEnd && newEnd < newStart
					? 'the end date is before the start'
					: !newAllDay && newTo <= newFrom
						? 'ends before it starts'
						: // Checked against the draft, so it reflects unsaved weekly changes too.
							redundantOneOffReason(newEntry, draftWindows, entries)
	);
	const addEntry = () => {
		if (addError) return;
		entries.push({ ...newEntry });
		entries.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startMin - b.startMin);
		// Make sure the new entry is visible even if it sorts below the cap.
		if (entries.length > ONE_OFF_PREVIEW_COUNT) showAllEntries = true;
		adding = false;
	};
	const removeEntry = (i: number) => entries.splice(i, 1);

	const cancel = () => {
		ranges = clone(original);
		entries = cloneOneOffs(originalOneOffs);
		adding = false;
		onCancel?.();
	};

	const changeSummary = $derived(
		[
			changedDays.length > 0 && changedDays.map((w) => WEEKDAY_LABELS[w]).join(', '),
			oneOffChanges > 0 && `${oneOffChanges} one-off ${oneOffChanges === 1 ? 'change' : 'changes'}`
		]
			.filter(Boolean)
			.join(' · ')
	);
	const dirty = $derived(changedDays.length > 0 || oneOffChanges > 0);
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
				showToast('hours saved');
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
					{@const dayConflicts = conflictsOn(weekday)}
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
								{#each dayConflicts as booking (booking.id)}
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

	<hr class="border-base-300" />

	<div class="flex flex-col gap-3">
		<div class="flex items-start justify-between gap-3">
			<div class="flex flex-col">
				<h3 class="font-headings text-lg">one-off changes</h3>
				<p class="text-base-content/60 text-sm">time off, or extra hours on specific dates.</p>
			</div>
			{#if !adding}
				<button type="button" class="btn btn-ghost btn-sm shrink-0" onclick={startAdding}>+ add</button>
			{/if}
		</div>

		{#if adding}
			<div class="bg-base-200 flex flex-col gap-3 rounded-field p-3 text-sm">
				<div class="flex gap-2">
					{#each [['closed', 'time off'], ['open', 'extra hours']] as const as [kind, label] (kind)}
						<button
							type="button"
							class="btn btn-xs rounded-full font-normal {newKind === kind
								? 'btn-neutral'
								: 'border-base-300 bg-base-100 text-base-content/70'}"
							onclick={() => setKind(kind)}
						>
							{label}
						</button>
					{/each}
				</div>
				<div class="flex flex-wrap items-end gap-3">
					<label class="flex flex-col gap-1">
						<span class="text-base-content/60 text-xs">from</span>
						<input type="date" class="input input-sm w-40" min={today} bind:value={newStart} />
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-base-content/60 text-xs">to (optional)</span>
						<input type="date" class="input input-sm w-40" min={newStart || today} bind:value={newEnd} />
					</label>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex cursor-pointer items-center gap-2">
						<input type="checkbox" class="toggle toggle-sm" bind:checked={newAllDay} />
						all day
					</label>
					{#if !newAllDay}
						<div class="flex items-center gap-2">
							<select class="select select-sm w-24" aria-label="from" bind:value={newFrom}>
								{#each START_OPTIONS as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							<span class="text-base-content/50">–</span>
							<select class="select select-sm w-24" aria-label="to" bind:value={newTo}>
								{#each END_OPTIONS as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
				<input
					type="text"
					class="input input-sm w-full max-w-sm"
					maxlength="100"
					placeholder="note (optional) — e.g. holiday"
					bind:value={newNote}
				/>
				{#if addError}
					<span class="text-error text-xs">{addError}</span>
				{/if}
				<div class="flex gap-2">
					<button type="button" class="btn btn-accent btn-xs" disabled={!!addError} onclick={addEntry}>
						add
					</button>
					<button type="button" class="btn btn-ghost btn-xs" onclick={() => (adding = false)}>cancel</button>
				</div>
			</div>
		{/if}

		{#if entries.length === 0}
			{#if !adding}
				<p class="text-base-content/50 text-sm">nothing coming up.</p>
			{/if}
		{:else}
			<ul class="border-base-300 divide-base-300 divide-y rounded-field border">
				{#each visibleEntries as entry, i (i)}
					<li class="flex items-center gap-3 px-3 py-2.5">
						<span
							class="badge badge-sm font-body shrink-0 {entry.kind === 'closed'
								? 'badge-neutral'
								: 'badge-success'}"
						>
							{entry.kind === 'closed' ? 'time off' : 'extra hours'}
						</span>
						<div class="min-w-0 flex-1">
							<div class="text-sm">{oneOffDatesLabel(entry)} · {oneOffTimesLabel(entry)}</div>
							{#if entry.note}
								<div class="text-base-content/60 truncate text-xs">{entry.note}</div>
							{/if}
							{#if entryErrors[i]}
								<div class="text-error text-xs">{entryErrors[i]} — this no longer changes anything, remove it</div>
							{/if}
						</div>
						<button
							type="button"
							class="btn btn-ghost btn-sm btn-square"
							aria-label="remove this change"
							onclick={() => removeEntry(i)}
						>
							✕
						</button>
					</li>
				{/each}
			</ul>
			{#if entries.length > ONE_OFF_PREVIEW_COUNT}
				<button
					type="button"
					class="text-accent self-start text-sm hover:underline"
					onclick={() => (showAllEntries = !showAllEntries)}
				>
					{showAllEntries ? 'show fewer' : `show ${entries.length - ONE_OFF_PREVIEW_COUNT} more`}
				</button>
			{/if}
		{/if}

		{#if oneOffConflicts.length > 0}
			<div class="border-error bg-error/10 flex flex-col gap-1 rounded-field border p-2 text-xs">
				<span class="font-medium">
					{oneOffConflicts.length === 1 ? 'a session falls' : `${oneOffConflicts.length} sessions fall`} outside
					your hours after these changes — {oneOffConflicts.length === 1 ? 'it stays' : 'they stay'} booked:
				</span>
				{#each oneOffConflicts as booking (booking.id)}
					<span>
						{booking.clientName} · {dayLabel(booking.startsAt, zone)} at {formatTime(booking.startsAt, zone)} ·
						{booking.status === 'confirmed' ? 'booked' : 'requested'}
					</span>
				{/each}
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
		<input type="hidden" name="oneOffs" value={JSON.stringify(entries)} />
		<span class="text-base-content/60 text-sm">
			{#if saveError}
				<span class="text-error">{saveError}</span>
			{:else if hasErrors}
				<span class="text-error">fix the hours marked above to save</span>
			{:else if !dirty}
				no changes yet
			{:else}
				unsaved changes to {changeSummary}
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
			{#each conflicts as booking (booking.id)}
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
			you've made changes ({changeSummary}) but haven't saved them.
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
