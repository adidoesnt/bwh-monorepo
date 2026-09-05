<script lang="ts">
	import ManageBookingModal from '$lib/components/ManageBookingModal.svelte';
	import { dateChip, relativeDay, timeOf } from '$lib/format';
	import { statusLabel, statusPill } from '$lib/status';
	import { browserZone } from '$lib/tz';
	import type { ClientBooking } from '$lib/server/queries';
    import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clientZone = untrack(() => data.user.timezone ?? browserZone());
	const zoneLabel = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
	const sgd = (cents: number) => `SG$${Math.round(cents / 100)}`;

	type Sort = 'soonest' | 'openest' | 'price' | 'name';
	let q = $state('');
	// Empty = "all". Multiple tags match a coach that has any of them.
	let picked = $state<string[]>([]);
	let sort = $state<Sort>('soonest');
	let limit = $state(10);
	let bkTab = $state<'upcoming' | 'awaiting' | 'past'>('upcoming');
	let banner = $state<'requested' | 'rescheduled' | null>(
		untrack(() => (data.requested ? 'requested' : data.rescheduled ? 'rescheduled' : null))
	);
	// Honour ?manage=<id> once — a deep link from the dashboard's "what's next".
	const deepLinked = untrack(() =>
		data.manageId ? (data.bookings ?? []).find((b) => b.id === data.manageId) : null
	);
	let manageTarget = $state<ClientBooking | null>(deepLinked ?? null);
	let manageOpen = $state(!!deepLinked);

	function manage(b: ClientBooking) {
		manageTarget = b;
		manageOpen = true;
	}

	const coaches = $derived(data.coaches ?? []);

	const tags = $derived([...new Set(coaches.flatMap((c) => c.tags))].sort());

	const toggleTag = (t: string) =>
		(picked = picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]);

	const matched = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return coaches
			.filter((c) => {
				const tagOk = picked.length === 0 || picked.some((t) => c.tags.includes(t));
				const hay =
					`${c.name} ${c.tagline} ${c.speciality} ${c.locations.join(' ')} ${c.tags.join(' ')}`.toLowerCase();
				return tagOk && (!needle || hay.includes(needle));
			})
			.sort((a, b) => {
				if (sort === 'price')
					return (a.cheapestSessionCents ?? Infinity) - (b.cheapestSessionCents ?? Infinity);
				if (sort === 'name') return a.name.localeCompare(b.name);
				if (sort === 'openest') return b.openCount - a.openCount;
				const at = a.nextFreeAt ? +new Date(a.nextFreeAt) : Infinity;
				const bt = b.nextFreeAt ? +new Date(b.nextFreeAt) : Infinity;
				return at - bt;
			});
	});
	const shown = $derived(matched.slice(0, limit));

	const bookings = $derived(data.bookings ?? []);
	const now = Date.now();
	const tabbed = $derived({
		upcoming: bookings.filter(
			(b) =>
				+new Date(b.startsAt) >= now &&
				b.status !== 'pending_approval' &&
				b.status !== 'completed'
		),
		awaiting: bookings.filter((b) => b.status === 'pending_approval'),
		past: bookings.filter((b) => +new Date(b.startsAt) < now || b.status === 'completed')
	});
	const bkTabs = [
		['upcoming', 'upcoming'],
		['awaiting', 'awaiting action'],
		['past', 'past']
	] as const;
</script>

{#snippet bookingRow(b: ClientBooking, chip: { mon: string; day: number })}
	<div class="bg-base-200 rounded-field w-12 shrink-0 py-1 text-center">
		<div class="text-base-content/60 font-body text-[10px] uppercase">{chip.mon}</div>
		<div class="font-headings text-lg leading-tight">{chip.day}</div>
	</div>
	<div class="min-w-0 flex-1">
		<div class="text-sm font-medium">{b.type}</div>
		<div class="text-base-content/60 mt-0.5 truncate text-xs">
			{timeOf(new Date(b.startsAt), clientZone)} · {b.coachName} · {b.location}
		</div>
		{#if b.clientReflection}
			<div class="text-base-content/45 mt-0.5 truncate text-[11px]">note · {b.clientReflection}</div>
		{/if}
	</div>
	<span class="badge badge-sm {statusPill[b.status]} font-body shrink-0">
		{statusLabel[b.status]}
	</span>
	<span class="text-base-content/30 shrink-0 text-xs">›</span>
{/snippet}

<div class="mx-auto max-w-5xl p-6 md:p-10">
	{#if !data.coaches}
		<div class="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
			<h1 class="font-headings text-3xl">bookings</h1>
			<p class="text-base-content/60 max-w-sm">
				the {data.user.role} portal is coming soon — your tools will live here.
			</p>
		</div>
	{:else}
		<h1 class="font-headings mb-1 text-4xl">bookings</h1>
		<p class="text-base-content/60 mb-6 text-sm">
			pick a coach to see her page, her hours and her rates.
		</p>

		{#if banner}
			<div class="border-success bg-success/25 mb-5 flex items-start justify-between gap-3 rounded-sm border p-4 text-sm">
				<span>
					{#if banner === 'rescheduled'}
						new time sent — your coach confirms it again, usually within a few hours.
					{:else}
						request sent — your coach confirms it, usually within a few hours.
					{/if}
					it's under
					<button class="link" onclick={() => (bkTab = 'awaiting')}>awaiting action</button> until then.</span>
				<button class="text-base-content/50 hover:text-base-content shrink-0" onclick={() => (banner = null)} aria-label="dismiss">✕</button>
			</div>
		{/if}

		<div class="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
			<!-- your bookings -->
			<section class="border-base-300 bg-white rounded-sm border p-5">
				<div class="mb-4 flex flex-wrap gap-1.5">
					{#each bkTabs as [id, label] (id)}
						<button
							class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors
								{bkTab === id ? 'border-neutral bg-neutral text-neutral-content' : 'border-base-300 text-base-content/60'}"
							onclick={() => (bkTab = id)}
						>
							{label}
							{#if id !== 'past' && tabbed[id].length > 0}
								<span
									class="rounded-full px-1.5 text-[10px] leading-4
										{bkTab === id ? 'bg-neutral-content/20' : 'bg-base-200 text-base-content/70'}"
								>
									{tabbed[id].length}
								</span>
							{/if}
						</button>
					{/each}
				</div>

				{#if tabbed[bkTab].length === 0}
					<div class="border-base-300 text-base-content/45 rounded-field border border-dashed p-8 text-center text-sm">
						nothing here yet.
					</div>
				{:else}
					<ul class="flex flex-col gap-2.5">
						{#each tabbed[bkTab] as b (b.id)}
							{@const chip = dateChip(new Date(b.startsAt), clientZone)}
							<li>
								<button
									type="button"
									class="border-base-200 bg-base-200/40 hover:border-primary flex w-full cursor-pointer items-center gap-3 rounded-field border p-3 text-left transition-colors"
									onclick={() => manage(b)}
								>
									{@render bookingRow(b, chip)}
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<p class="text-base-content/40 mt-4 text-xs">
					times shown in your timezone ({zoneLabel(clientZone)}).
				</p>
			</section>

			<!-- choose your coach -->
			<section class="border-base-300 bg-white rounded-sm border p-5">
				<h2 class="font-headings mb-1 text-xl">choose your coach</h2>
				<p class="text-base-content/60 mb-4 text-xs">
					each coach keeps her own page, hours and rates. you can train with more than one.
				</p>

				<input
					class="input input-sm border-base-300 bg-base-100 mb-2.5 w-full"
					placeholder="search by name, speciality or location…"
					bind:value={q}
				/>

				<div class="mb-3 flex gap-1.5 overflow-x-auto pb-1.5">
					<button
						class="shrink-0 rounded-full border px-3 py-1 text-xs transition-colors
							{picked.length === 0
							? 'border-neutral bg-neutral text-neutral-content'
							: 'border-base-300 text-base-content/60'}"
						onclick={() => (picked = [])}
					>
						all
					</button>
					{#each tags as t (t)}
						<button
							class="shrink-0 rounded-full border px-3 py-1 text-xs transition-colors
								{picked.includes(t)
								? 'border-neutral bg-neutral text-neutral-content'
								: 'border-base-300 text-base-content/60'}"
							onclick={() => toggleTag(t)}
						>
							{t}
						</button>
					{/each}
				</div>

				<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
					<span class="text-base-content/45 font-body text-xs">
						showing {shown.length} of {matched.length}{#if matched.length !== coaches.length} · {coaches.length} coaches{/if}
					</span>
					<div class="flex items-center gap-2">
						<label class="text-base-content/45 flex items-center gap-1.5 text-xs">
							sort
							<select class="select select-xs border-base-300" bind:value={sort}>
								<option value="soonest">soonest available</option>
								<option value="openest">most open slots</option>
								<option value="price">price, low to high</option>
								<option value="name">name, a–z</option>
							</select>
						</label>
						<label class="text-base-content/45 flex items-center gap-1.5 text-xs">
							show
							<select class="select select-xs border-base-300" bind:value={limit}>
								<option value={5}>5</option>
								<option value={10}>10</option>
								<option value={25}>25</option>
							</select>
						</label>
					</div>
				</div>

				{#if shown.length === 0}
					<div class="border-base-300 rounded-field border border-dashed p-8 text-center">
						<p class="text-base-content/60 mb-3 text-sm">no coach matches that yet.</p>
						<button
							class="btn btn-sm btn-ghost"
							onclick={() => {
								q = '';
								picked = [];
							}}>clear search</button
						>
					</div>
				{:else}
					<ul class="flex flex-col gap-3">
						{#each shown as c (c.id)}
							{@const cross = c.timezone !== clientZone}
							<li>
								<a
									href="/bookings/{c.slug}"
									class="border-base-300 hover:border-primary bg-base-100 flex gap-3.5 rounded-field border p-4 transition-colors"
								>
									<span
										class="bg-base-200 font-body text-base-content/50 grid h-16 w-13 shrink-0 place-items-center rounded-field text-base"
										>{c.name[0]}</span
									>
									<span class="min-w-0 flex-1">
										<span class="flex items-baseline justify-between gap-2">
											<span class="font-headings text-xl">{c.name}</span>
											{#if c.cheapestSessionCents !== null}
												<span class="text-primary font-body text-xs"
													>from <span class="uppercase">{sgd(c.cheapestSessionCents)}</span>/session</span
												>
											{/if}
										</span>
										<span class="text-base-content/60 mt-1 block text-xs leading-snug">{c.tagline}</span>
										<span class="text-base-content/45 font-body mt-1.5 block text-[11px]">
											{c.tags.slice(0, 3).join(' · ')}
										</span>
										<span class="text-base-content/60 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
											<span>
												{#if c.nextFreeAt}next free {relativeDay(new Date(c.nextFreeAt), clientZone)}{:else}no open slots{/if}
											</span>
											<span>{c.openCount} open starts</span>
											{#if cross}
												<span class="text-base-content/45">online only · {zoneLabel(c.timezone)}</span>
											{/if}
										</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}

	{#if manageTarget}
		<ManageBookingModal booking={manageTarget} {clientZone} bind:open={manageOpen} />
	{/if}
</div>
