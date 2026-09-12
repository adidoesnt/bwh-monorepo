<script lang="ts">
	import { ChevronLeftIcon, ChevronRightIcon } from '@repo/ui';
	import type { PageProps } from './$types';
	import {
		balanceProgressClass,
		dayNumber,
		formatFullDate,
		formatTime,
		getPackageSlides,
		getStats,
		isClient,
		monthAbbrev,
		statusBadgeClass,
		statusLabel,
		viewerZone
	} from './dashboard';

	let { data }: PageProps = $props();

	const firstName = $derived(data.user.name.split(' ')[0] ?? data.user.name);

	const clientView = $derived(isClient(data));
	const zone = $derived(viewerZone(data));
	const stats = $derived(getStats(data, zone));
	const packageSlides = $derived(getPackageSlides(data));
</script>

{#snippet statCard(stat: { label: string; value: string; sub: string })}
	<div class="bg-base-100 border-base-300 rounded-2xl border p-4">
		<div class="text-base-content/60 text-sm">{stat.label}</div>
		<div class="font-headings text-2xl">{stat.value}</div>
		<div class="text-base-content/50 text-xs">{stat.sub}</div>
	</div>
{/snippet}

{#snippet whatsNext()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">what's next</h2>
			<span class="text-accent text-sm" title="coming soon">all bookings</span>
		</div>
		{#if data.upcomingBookings.length === 0}
			<p class="text-base-content/60 text-sm">no upcoming sessions yet.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.upcomingBookings as b (b.id)}
					<div class="bg-base-200 flex items-center gap-3 rounded-field p-3">
						<div
							class="bg-base-300 flex w-12 flex-col items-center rounded-field py-1.5 text-center leading-tight"
						>
							<span class="text-base-content/50 text-[10px]">{monthAbbrev(b.startsAt, zone)}</span>
							<span class="font-headings text-lg">{dayNumber(b.startsAt, zone)}</span>
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">{b.type}</div>
							<div class="text-base-content/60 truncate text-xs">
								{formatTime(b.startsAt, zone)} · {b.coachName} · {b.location}
							</div>
						</div>
						<span class="badge badge-sm {statusBadgeClass(b.status)} font-body shrink-0"
							>{statusLabel(b.status)}</span
						>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet packageCarousel()}
	<div class="bg-neutral text-neutral-content flex flex-col gap-4 rounded-2xl p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">your packages</h2>
			<span class="text-neutral-content/60 text-sm">{data.activePackages.length} active</span>
		</div>
		{#if packageSlides.length === 0}
			<p class="text-neutral-content/60 text-sm">no active packages — get one to start booking.</p>
		{:else}
			<!-- TODO: auto-scroll this carousel (pause on hover/touch, respect prefers-reduced-motion) -->
			<div class="carousel carousel-center w-full gap-4">
				{#each packageSlides as pkg (pkg.purchaseId)}
					<div id={pkg.slideId} class="carousel-item w-full flex-col gap-3">
						<div>
							<div class="text-sm opacity-70">{pkg.packageName} · {pkg.coachName}</div>
							<div class="font-headings text-3xl">
								{pkg.balance} <span class="text-lg opacity-60">of {pkg.sessionCount} left</span>
							</div>
						</div>
						<progress
							class="progress {balanceProgressClass(pkg.balance, pkg.sessionCount)} w-full"
							value={pkg.balance}
							max={pkg.sessionCount}
						></progress>
						<div class="flex items-center justify-between text-sm opacity-70">
							<span>expires {formatFullDate(pkg.expiresAt, zone)}</span>
							{#if packageSlides.length > 1}
								<span class="flex gap-1">
									<a href="#{pkg.prevId}" class="btn btn-circle btn-xs btn-ghost">
										<ChevronLeftIcon className="h-3 w-3" />
									</a>
									<a href="#{pkg.nextId}" class="btn btn-circle btn-xs btn-ghost">
										<ChevronRightIcon className="h-3 w-3" />
									</a>
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet weeklyFocus()}
	<div class="bg-success/30 text-success-content flex flex-col gap-3 rounded-2xl p-5">
		<h2 class="font-headings text-xl">this week's focus</h2>
		<!-- TODO: real per-coach carousel backed by a weekly_focus table (see DATA-MODEL.md discussion) -->
		<p class="text-success-content/70 text-sm">
			your coaches' focus for the week will show up here once programming is wired up.
		</p>
	</div>
{/snippet}

{#snippet recentActivity()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">recent activity</h2>
			<span class="text-accent text-sm" title="coming soon">view all</span>
		</div>
		{#if data.recentActivity.length === 0}
			<p class="text-base-content/60 text-sm">nothing here yet.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.recentActivity as entry (entry.id)}
					<div class="flex items-center justify-between gap-3 text-sm">
						<span class="min-w-0 truncate">{entry.description}</span>
						<span class="shrink-0 {entry.delta >= 0 ? 'text-success' : 'text-error'}">
							{entry.delta >= 0 ? '+' : ''}{entry.delta}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<div class="flex items-center justify-between">
		<h1 class="font-headings text-3xl">hey {firstName}!</h1>
		<button type="button" class="btn btn-accent" disabled title="coming soon">request a session</button>
	</div>

	{#if clientView}
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			{#each stats as stat (stat.label)}
				{@render statCard(stat)}
			{/each}
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render whatsNext()}
			{@render packageCarousel()}
			{@render weeklyFocus()}
			{@render recentActivity()}
		</div>
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
