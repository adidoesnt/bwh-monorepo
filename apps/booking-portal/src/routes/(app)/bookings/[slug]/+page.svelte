<script lang="ts">
	import { enhance } from '$app/forms';
	import { daySlots } from '$lib/availability';
	import {
		CONSULT_MIN,
		MAX_ACTIVE_PACKAGES,
		ONLINE_LOCATION,
		ONLINE_TYPES,
		PRE_SCREENING_TYPES,
		SESSION_TYPES
	} from '$lib/booking';
	import BuyPackageModal from '$lib/components/BuyPackageModal.svelte';
	import type { SessionType } from '@repo/database/schema';
	import { longDate, longDateNoYear, MONTHS, timeOf } from '$lib/format';
	import type { PackageSummary } from '$lib/server/queries';
	import { addDaysISO, browserZone, datesInRange, nextDates, zoneParts } from '$lib/tz';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// ssr=false + a fresh instance per navigation, so load data is static here.
	const d0 = untrack(() => data);

	const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	const hhmm = (m: number) =>
		`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
	const zoneLabel = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
	const sgd = (cents: number) => `SG$${Math.round(cents / 100)}`;

	const modeChip = (on: boolean) =>
		on
			? 'border-neutral bg-neutral text-neutral-content'
			: 'border-base-300 hover:border-base-content/30';
	const whenChip = (on: boolean, ok = true) =>
		!ok
			? 'border-transparent bg-base-200/50 text-base-content/30 line-through'
			: on
				? 'border-primary bg-primary text-primary-content'
				: 'border-transparent bg-base-200 hover:bg-base-300';

	const coach = d0.coach;
	const firstName = coach.name.split(' ')[0];
	const canBook = d0.canBook;
	const clientZone = d0.user.timezone ?? browserZone();
	const crossZone = coach.timezone !== clientZone;
	const needsScreening = canBook && !d0.intakeComplete;

	const allowedTypes: readonly SessionType[] = needsScreening
		? PRE_SCREENING_TYPES
		: crossZone
			? SESSION_TYPES.filter((t) => ONLINE_TYPES.includes(t))
			: SESSION_TYPES;
	const locations = crossZone
		? [ONLINE_LOCATION]
		: [...coach.locations.filter((l) => l !== 'online'), ONLINE_LOCATION];

	const rb = d0.reschedule;
	const purchases = d0.purchases;
	const packages = d0.packages;

	const todayISO = nextDates(1, coach.timezone)[0] ?? '';
	const isoOf = (d: Date) => zoneParts(d, coach.timezone).dateISO;

	let type = $state<SessionType>(
		rb && allowedTypes.includes(rb.type) ? rb.type : (allowedTypes[0] ?? 'free consult')
	);
	let purchaseId = $state(purchases[0]?.id ?? '');
	let selectedMonth = $state('');
	let dateISO = $state(todayISO);
	let startMin = $state<number | null>(null);
	let location = $state(rb && locations.includes(rb.location) ? rb.location : (locations[0] ?? ''));
	let note = $state(rb?.note ?? '');
	let submitting = $state(false);

	let buyTarget = $state<PackageSummary | null>(null);
	let buyOpen = $state(false);
	function buy(pk: PackageSummary) {
		if (d0.atPackageCap) return;
		buyTarget = pk;
		buyOpen = true;
	}

	// A booking always needs a coach package (or is a free consult / reschedule).
	const hasPackage = $derived(purchases.length > 0);
	const showForm = $derived(!!rb || type === 'free consult' || hasPackage);

	type Src =
		| { kind: 'reschedule'; lengthMin: number; endISO: string }
		| { kind: 'consult'; lengthMin: number; endISO: string }
		| { kind: 'purchase'; id: string; lengthMin: number; endISO: string; label: string };

	const src = $derived.by<Src>(() => {
		if (rb) {
			return {
				kind: 'reschedule',
				lengthMin: rb.durationMin,
				endISO: rb.purchaseExpiresAt ? isoOf(new Date(rb.purchaseExpiresAt)) : addDaysISO(todayISO, 56)
			};
		}
		if (type === 'free consult') {
			return { kind: 'consult', lengthMin: CONSULT_MIN, endISO: addDaysISO(todayISO, 56) };
		}
		const p = purchases.find((x) => x.id === purchaseId) ?? purchases[0];
		if (p) {
			return {
				kind: 'purchase',
				id: p.id,
				lengthMin: p.sessionLengthMin,
				endISO: isoOf(new Date(p.expiresAt)),
				label: p.packageName
			};
		}
		return { kind: 'consult', lengthMin: CONSULT_MIN, endISO: addDaysISO(todayISO, 56) };
	});

	const durationMin = $derived(src.lengthMin);

	type MonthGroup = {
		key: string;
		label: string;
		days: { iso: string; dow: string; dom: number }[];
	};
	const months = $derived.by<MonthGroup[]>(() => {
		const out: MonthGroup[] = [];
		for (const iso of datesInRange(todayISO, src.endISO)) {
			const [y, mo, d] = iso.split('-').map(Number);
			if (y === undefined || mo === undefined || d === undefined) continue;
			const key = `${y}-${mo}`;
			let m = out.find((x) => x.key === key);
			if (!m) {
				const showYear = String(y) !== todayISO.slice(0, 4);
				m = { key, label: showYear ? `${MONTHS[mo - 1]} ${y % 100}` : (MONTHS[mo - 1] ?? ''), days: [] };
				out.push(m);
			}
			m.days.push({ iso, dow: DOW[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()] ?? '', dom: d });
		}
		return out;
	});

	$effect(() => {
		const all = months.flatMap((m) => m.days.map((d) => d.iso));
		if (all.length === 0) return;
		if (!all.includes(dateISO)) dateISO = all[0] ?? dateISO;
		const owning = months.find((m) => m.days.some((d) => d.iso === dateISO));
		if (owning && owning.key !== selectedMonth) selectedMonth = owning.key;
	});

	const monthDays = $derived(
		months.find((m) => m.key === selectedMonth)?.days ?? months[0]?.days ?? []
	);

	function pickMonth(key: string) {
		selectedMonth = key;
		const days = months.find((m) => m.key === key)?.days ?? [];
		if (!days.some((d) => d.iso === dateISO)) dateISO = days[0]?.iso ?? dateISO;
	}

	const busy = d0.busy.map((b) => ({ startsAt: new Date(b.startsAt), durationMin: b.durationMin }));

	const slots = $derived(
		daySlots({ windows: d0.windows, busy, dateISO, durationMin, coachZone: coach.timezone })
	);

	$effect(() => {
		if (!slots.some((s) => s.ok && s.startMin === startMin)) {
			startMin = slots.find((s) => s.ok)?.startMin ?? null;
		}
	});

	const selected = $derived(
		startMin === null ? null : (slots.find((s) => s.startMin === startMin) ?? null)
	);
	const endsAt = $derived(selected ? new Date(selected.at.getTime() + durationMin * 60_000) : null);

	const hours = [
		...new Map(d0.windows.map((w) => [`${w.startMin}-${w.endMin}`, w])).values()
	].sort((a, b) => a.startMin - b.startMin);

	function copyLink() {
		navigator.clipboard?.writeText(`https://builtwithhabit.com/book/${coach.slug}`).catch(() => {});
	}
</script>

<div class="mx-auto max-w-3xl p-6 md:p-10">
	<a
		href="/bookings"
		class="text-base-content/60 hover:text-base-content mb-4 inline-block text-sm">← all coaches</a
	>

	<div class="border-base-300 rounded-lg border bg-white p-4 md:p-6">
		<!-- coach header -->
		<div class="bg-neutral text-neutral-content mb-5 flex gap-4 rounded-md p-5">
			<div
				class="bg-neutral-content/10 text-neutral-content/50 font-body grid h-20 w-16 shrink-0 place-items-center rounded-field text-xs"
			>
				photo
			</div>
			<div class="min-w-0 flex-1">
				<div class="font-headings text-3xl leading-tight">{coach.name}</div>
				<div class="text-neutral-content/70 mt-1 text-sm">{coach.tagline}</div>
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#each coach.tags as t (t)}
						<span
							class="bg-neutral-content/10 font-body rounded-full px-2 py-1 text-[10px] tracking-wide"
							style="color:oklch(0.8 0.09 45)">{t}</span
						>
					{/each}
				</div>
			</div>
		</div>

		<div class="mb-4 grid gap-2.5 sm:grid-cols-2">
			<div class="border-base-300 bg-base-200/40 rounded-md border p-3">
				<div class="text-base-content/45 mb-1 text-[11px]">packages</div>
				<div class="text-sm">
					{#if coach.cheapestSessionCents !== null}
						from <span class="uppercase">{sgd(coach.cheapestSessionCents)}</span> per session
					{:else}
						none published yet
					{/if}
				</div>
			</div>
			<div class="border-base-300 bg-base-200/40 rounded-md border p-3">
				<div class="text-base-content/45 mb-1 text-[11px]">trains at</div>
				<div class="text-sm">{coach.locations.join(' · ')}</div>
			</div>
		</div>

		<p class="text-base-content/70 mb-4 text-sm leading-relaxed">{coach.bio}</p>

		{#if packages.length > 0}
			<div class="border-base-300 mb-4 rounded-md border">
				<div class="text-base-content/45 border-base-200 border-b px-3 py-2 text-[11px]">
					{firstName}'s packages
				</div>
				<ul class="divide-base-200 divide-y">
					{#each packages as p (p.id)}
						<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
							<span class="min-w-0">
								<span class="font-medium">{p.name}</span>
								<span class="text-base-content/55 text-xs">
									· {p.sessionCount} × {p.sessionLengthMin} min · valid {p.validityDays} days
								</span>
							</span>
							{#if canBook}
								<button
									class="btn btn-xs btn-ghost border-base-300 shrink-0"
									disabled={d0.atPackageCap}
									onclick={() => buy(p)}
								>
									buy · <span class="uppercase">{sgd(p.pricePerSessionCents * p.sessionCount)}</span>
								</button>
							{:else}
								<span class="font-body shrink-0 text-xs">
									<span class="uppercase">{sgd(p.pricePerSessionCents)}</span>/session
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="bg-base-200/50 mb-4 flex flex-wrap items-center gap-2.5 rounded-md p-3">
			<span class="text-base-content/60 font-body min-w-40 flex-1 text-xs"
				>builtwithhabit.com/book/{coach.slug}</span
			>
			<button class="btn btn-xs btn-ghost border-base-300" onclick={copyLink}>copy link</button>
		</div>

		<div class="text-base-content/60 flex flex-wrap items-center gap-2 text-xs">
			<span class="text-base-content/45 font-body text-[10px] tracking-widest uppercase"
				>open hours · {zoneLabel(coach.timezone)} time</span
			>
			{#each hours as h (h.startMin + '-' + h.endMin)}
				<span class="badge badge-sm badge-ghost font-body">{hhmm(h.startMin)} – {hhmm(h.endMin)}</span>
			{/each}
		</div>

		{#if !canBook}
			<div
				class="border-base-300 text-base-content/60 mt-4 rounded-md border border-dashed p-6 text-center text-sm"
			>
				sign in as a client to request a session.
			</div>
		{:else}
			<div class="border-base-200 -mx-4 mt-5 border-t px-4 pt-5 md:-mx-6 md:px-6">
				{#if rb}
					<h2 class="font-headings mb-1 text-xl">reschedule with {firstName}</h2>
					<p class="text-base-content/60 mb-4 text-sm">
						moving your {longDate(new Date(rb.startsAt), clientZone)} · {timeOf(
							new Date(rb.startsAt),
							clientZone
						)} session{rb.packageName ? ` (${rb.packageName})` : ''} — pick a new time and {firstName}
						confirms it again.
					</p>
				{:else}
					<h2 class="font-headings mb-1 text-xl">book {firstName}</h2>
					<p class="text-base-content/60 mb-4 text-sm">
						you're asking for a slot, not taking it — {firstName} approves it, usually within a few hours.
					</p>
				{/if}

				{#if crossZone}
					<div class="border-warning bg-warning/15 mb-4 rounded-md border p-3 text-xs leading-relaxed">
						{firstName} coaches from {zoneLabel(coach.timezone)} and you're in {zoneLabel(clientZone)} —
						only online sessions are offered. dates below are {zoneLabel(coach.timezone)} dates; a slot
						may land on a different day in your timezone.
					</div>
				{/if}

				{#if needsScreening}
					<div class="border-error bg-error/15 mb-4 rounded-md border p-3 text-xs leading-relaxed">
						<p class="font-bold">screening incomplete</p>
						<p>
							you can only book a <strong>free consult</strong> for now. training sessions unlock once your
							par-q health screening is done.
						</p>
					</div>
				{/if}

				{#if form?.error}
					<div class="border-error bg-error/15 mb-4 rounded-md border p-3 text-sm">{form.error}</div>
				{/if}

				<div class="text-base-content/60 mb-2 text-xs">session type</div>
				<div class="mb-5 flex flex-wrap gap-2">
					{#each allowedTypes as t (t)}
						<button
							type="button"
							onclick={() => (type = t)}
							class="rounded-full border px-3.5 py-1.5 text-sm transition-colors {modeChip(type === t)}"
						>
							{t}
						</button>
					{/each}
				</div>

				{#if !showForm}
					<div class="border-base-300 bg-base-200/40 rounded-md border p-4 text-sm">
						<p class="mb-3">
							you'll need a package with {firstName} to book a training session. pick one:
						</p>
						{#if d0.atPackageCap}
							<p class="text-base-content/55">
								you're already holding the max of {MAX_ACTIVE_PACKAGES} packages — use some sessions or
								let one expire first.
							</p>
						{:else if packages.length === 0}
							<p class="text-base-content/45">{firstName} hasn't published any packages yet.</p>
						{:else}
							<div class="flex flex-col gap-2">
								{#each packages as pk (pk.id)}
									<button
										class="border-base-300 hover:border-primary bg-base-100 flex items-center justify-between gap-3 rounded-field border p-3 text-left transition-colors"
										onclick={() => buy(pk)}
									>
										<span class="min-w-0">
											<span class="font-medium">{pk.name}</span>
											<span class="text-base-content/55 text-xs">
												· {pk.sessionCount} × {pk.sessionLengthMin} min
											</span>
											{#if pk.description}
												<span class="text-base-content/55 mt-0.5 block text-xs">{pk.description}</span>
											{/if}
										</span>
										<span class="btn btn-xs btn-primary shrink-0">
											<span class="uppercase">{sgd(pk.pricePerSessionCents * pk.sessionCount)}</span>
										</span>
									</button>
								{/each}
							</div>
						{/if}
						{#if !needsScreening}
							<p class="text-base-content/50 mt-3 text-xs">
								or pick <button class="link" onclick={() => (type = 'free consult')}>free consult</button>
								above — no package needed.
							</p>
						{/if}
					</div>
				{:else}
					<form
						method="POST"
						action={rb ? '?/reschedule' : '?/request'}
						use:enhance={() => {
							submitting = true;
							return async ({ update }) => {
								await update();
								submitting = false;
							};
						}}
					>
						{#if rb}
							<input type="hidden" name="bookingId" value={rb.id} />
						{:else if src.kind === 'purchase'}
							<input type="hidden" name="purchaseId" value={src.id} />
						{/if}
						<input type="hidden" name="dateISO" value={dateISO} />
						<input type="hidden" name="startMin" value={startMin ?? ''} />
						<input type="hidden" name="type" value={type} />
						<input type="hidden" name="clientZone" value={clientZone} />

						{#if !rb && type !== 'free consult' && purchases.length > 1}
							<div class="text-base-content/60 mb-2 text-xs">which package?</div>
							<div class="mb-5 flex flex-col gap-2">
								{#each purchases as p (p.id)}
									<button
										type="button"
										onclick={() => (purchaseId = p.id)}
										class="rounded-field border px-3 py-2 text-left text-sm transition-colors {modeChip(
											purchaseId === p.id
										)}"
									>
										<span class="font-medium">{p.packageName}</span>
										<span class="opacity-70">
											· {p.sessionLengthMin} min · {p.sessionsRemaining} left · expires {longDateNoYear(
												new Date(p.expiresAt),
												clientZone
											)}
										</span>
									</button>
								{/each}
							</div>
						{/if}

						<div class="text-base-content/60 mb-2 text-xs">date</div>
						{#if months.length > 1}
							<div class="mb-2 flex flex-wrap gap-1.5">
								{#each months as m (m.key)}
									<button
										type="button"
										onclick={() => pickMonth(m.key)}
										class="rounded-full border px-3 py-1 text-xs transition-colors {modeChip(
											selectedMonth === m.key
										)}"
									>
										{m.label}
									</button>
								{/each}
							</div>
						{/if}
						<div class="mb-5 flex gap-1.5 overflow-x-auto pb-1.5">
							{#each monthDays as d (d.iso)}
								<button
									type="button"
									onclick={() => (dateISO = d.iso)}
									class="w-14 shrink-0 rounded-field border py-1.5 text-center transition-colors {whenChip(
										dateISO === d.iso
									)}"
								>
									<span class="font-body block text-[10px] uppercase opacity-70">{d.dow}</span>
									<span class="font-headings block text-lg leading-tight">{d.dom}</span>
								</button>
							{/each}
						</div>

						{#if src.kind === 'purchase'}
							<p class="text-base-content/45 -mt-3.5 mb-5 text-[11px]">
								your {src.label} sessions expire {longDateNoYear(new Date(src.endISO), clientZone)}.
							</p>
						{/if}

						<div class="text-base-content/60 mb-2 text-xs">
							time · shown in your timezone ({zoneLabel(clientZone)})
						</div>
						{#if slots.length === 0}
							<div
								class="border-base-300 text-base-content/45 mb-5 rounded-field border border-dashed p-6 text-center text-sm"
							>
								{firstName} has no {durationMin}-minute openings that day.
							</div>
						{:else}
							<div class="mb-5 grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(72px,1fr))">
								{#each slots as s (s.startMin)}
									<button
										type="button"
										disabled={!s.ok}
										onclick={() => (startMin = s.startMin)}
										class="font-body rounded-field border py-2 text-sm transition-colors {whenChip(
											startMin === s.startMin && s.ok,
											s.ok
										)}"
									>
										{timeOf(s.at, clientZone)}
									</button>
								{/each}
							</div>
						{/if}

						<label class="text-base-content/60 mb-4 flex flex-col gap-1.5 text-xs">
							location
							<select class="select select-sm border-base-300 w-full" name="location" bind:value={location}>
								{#each locations as l (l)}
									<option value={l}>{l}</option>
								{/each}
							</select>
						</label>

						<label class="text-base-content/60 mb-4 flex flex-col gap-1.5 text-xs">
							anything {firstName} should know?
							<textarea
								name="note"
								bind:value={note}
								rows="3"
								maxlength="500"
								placeholder="niggling left knee this week — happy to swap lunges"
								class="textarea textarea-sm border-base-300 w-full leading-relaxed"
							></textarea>
						</label>

						<div
							class="bg-base-200/60 mb-3 flex items-center justify-between gap-3 rounded-field p-3 text-sm"
						>
							<span class="text-base-content/70">
								{#if selected && endsAt}
									{type} · {longDate(selected.at, clientZone)} · {timeOf(selected.at, clientZone)}–{timeOf(
										endsAt,
										clientZone
									)}
								{:else}
									pick a time to continue
								{/if}
							</span>
							<strong class="font-body">
								{src.kind === 'consult' ? 'free' : '1 session'}
							</strong>
						</div>

						<button
							type="submit"
							class="btn btn-primary w-full"
							disabled={startMin === null || submitting}
						>
							{#if submitting}
								{rb ? 'moving…' : 'sending…'}
							{:else if rb}
								confirm new time
							{:else}
								send request
							{/if}
						</button>
					</form>
				{/if}
			</div>
		{/if}
	</div>

	{#if buyTarget}
		<BuyPackageModal
			pkg={{ ...buyTarget, coachName: coach.name }}
			stripeEnabled={d0.stripeEnabled}
			bind:open={buyOpen}
		/>
	{/if}
</div>
