<script lang="ts">
	import { dateChip, longDate, longDateNoYear, relativeDay, timeOf } from '$lib/format';
	import { statusLabel, statusPill } from '$lib/status';
	import { browserZone } from '$lib/tz';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const firstName = $derived(data.user.name.split(' ')[0] ?? data.user.name);
	const today = new Date();
	// Everything on this screen shows in the viewer's zone (their set zone, else the browser's).
	const tz = untrack(() => data.user.timezone) ?? browserZone();

	const dash = $derived(data.dashboard);

	const stats = $derived(
		dash
			? [
					{
						label: 'next session',
						value: dash.stats.nextSessionAt
							? relativeDay(dash.stats.nextSessionAt, tz, today)
							: '—',
						sub: dash.stats.nextSessionAt
							? `${timeOf(dash.stats.nextSessionAt, tz)} · ${dash.upcoming[0]?.coachName ?? ''}`
							: 'nothing booked'
					},
					{
						label: 'sessions left',
						value: String(dash.sessionsRemaining),
						sub:
							dash.packages.length === 0
								? 'no active package'
								: dash.packages.length === 1
									? `${dash.packages[0]!.packageName} · with ${dash.packages[0]!.coachName.split(' ')[0]}`
									: `across ${dash.packages.length} packages`
					},
					{ label: 'sessions done', value: String(dash.stats.sessionsDone), sub: 'completed with us' },
					{ label: 'this week', value: String(dash.stats.thisWeek), sub: 'confirmed or done' }
				]
			: []
	);

	// Bar colour tracks how much of a package is left: healthy → running low → nearly out.
	const pkgPct = (left: number, granted: number) =>
		granted > 0 ? Math.round((left / granted) * 100) : 0;
	const pkgBarClass = (p: number) => (p > 50 ? 'bg-success' : p > 20 ? 'bg-warning' : 'bg-error');
</script>

<div class="mx-auto max-w-5xl p-6 md:p-10">
	{#if !dash}
		<div class="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
			<h1 class="font-headings text-3xl">welcome, {firstName}.</h1>
			<p class="text-base-content/60 max-w-sm">
				the {data.user.role} portal is coming soon — your tools will live here.
			</p>
		</div>
	{:else}
		<!-- header -->
		<div class="mb-7 flex flex-wrap items-end justify-between gap-4">
			<div>
				<div class="text-base-content/45 font-body mb-1.5 text-xs tracking-widest uppercase">
					{longDate(today, tz)}
				</div>
				<h1 class="font-headings text-4xl">hey {firstName}!</h1>
			</div>
			<a href="/bookings" class="btn btn-primary btn-sm">request a session</a>
		</div>

		<!-- stat cards -->
		<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
			{#each stats as s (s.label)}
				<div class="border-base-300 bg-white rounded-sm border p-4">
					<div class="text-base-content/60 mb-2 text-xs">{s.label}</div>
					<div class="font-headings text-2xl leading-none">{s.value}</div>
					<div class="text-base-content/45 mt-1.5 text-xs">{s.sub}</div>
				</div>
			{/each}
		</div>

		<div class="grid gap-4 md:grid-cols-[3fr_2fr]">
			<!-- what's next -->
			<section class="border-base-300 bg-white rounded-sm border p-5">
				<h2 class="font-headings mb-4 text-xl">what's next</h2>
				{#if dash.upcoming.length === 0}
					<div
						class="border-base-300 text-base-content/45 rounded-field border border-dashed p-8 text-center text-sm"
					>
						nothing booked yet.
					</div>
				{:else}
					<ul class="flex flex-col gap-2.5">
						{#each dash.upcoming as b (b.id)}
							{@const chip = dateChip(new Date(b.startsAt), tz)}
							<li class="border-base-200 bg-base-200/40 flex items-center gap-3.5 rounded-field border p-3.5">
								<div class="bg-base-200 rounded-field w-13 shrink-0 py-1.5 text-center">
									<div class="text-base-content/60 font-body text-[10px] uppercase">{chip.mon}</div>
									<div class="font-headings text-xl leading-tight">{chip.day}</div>
								</div>
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium">{b.type}</div>
									<div class="text-base-content/60 mt-0.5 text-xs">
										{timeOf(new Date(b.startsAt), tz)} · {b.coachName} · {b.location}
									</div>
								</div>
								<span class="badge badge-sm {statusPill[b.status]} font-body shrink-0">
									{statusLabel[b.status]}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<!-- right column -->
			<div class="flex flex-col gap-4">
				<section class="bg-neutral text-neutral-content rounded-sm p-5">
					{#if dash.packages.length === 0}
						<div class="text-neutral-content/70 text-sm">
							no active package. pick a coach to see her packages.
						</div>
					{:else}
						<div class="text-neutral-content/60 mb-3 text-xs">your packages</div>
						<ul class="flex flex-col gap-4">
							{#each dash.packages as p (p.coachName + p.packageName + p.expiresAt)}
								{@const pct = pkgPct(p.sessionsRemaining, p.sessionsGranted)}
								<li>
									<div class="mb-1 flex items-end justify-between gap-2">
										<span class="text-sm">
											{p.packageName} · <span class="text-neutral-content/60">{p.coachName.split(' ')[0]}</span>
										</span>
										<span class="font-headings text-lg leading-none">
											{p.sessionsRemaining}<span class="text-neutral-content/50 text-xs">/{p.sessionsGranted}</span>
										</span>
									</div>
									<div class="bg-neutral-content/15 mb-1 h-1.5 overflow-hidden rounded-full">
										<div class="{pkgBarClass(pct)} h-full rounded-full transition-all" style:width="{pct}%"></div>
									</div>
									<div class="text-neutral-content/60 text-xs">
										expires {longDateNoYear(new Date(p.expiresAt), tz)}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
					<a
						href="/bookings"
						class="border-neutral-content/25 text-neutral-content hover:bg-neutral-content/10 mt-4 block w-full rounded-field border px-3 py-2 text-center text-sm transition-colors"
					>
						browse packages
					</a>
				</section>

				<section class="border-success bg-success/30 flex-1 rounded-sm border p-5">
					<h3 class="font-headings mb-2 text-lg">this week's focus</h3>
					<p class="text-base-content/60 text-sm leading-relaxed">
						your coach sets a weekly focus once programming is wired up.
					</p>
				</section>
			</div>
		</div>
	{/if}
</div>
