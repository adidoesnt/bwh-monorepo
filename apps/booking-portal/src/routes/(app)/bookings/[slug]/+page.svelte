<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { NETWORK_ERROR_MESSAGE, isNetworkFailure } from '$lib/utils/forms';
	import { page } from '$app/state';
	import { CoachHeader } from '$lib/components';
	import { ChevronLeftIcon, ChevronRightIcon } from '@repo/ui';
	import {
		dayNumber,
		formatMinuteRange,
		formatPriceCents,
		formatTime,
		monthYearLabel,
		weekdayAbbrev
	} from '$lib/utils/format';
	import type { PageProps } from './$types';
	import {
		SESSION_TYPES,
		adjacentMonth,
		cheapestPackagePriceCents,
		dateForParts,
		dateParamValue,
		daysInMonth,
		enumerateDateRange,
		hasDayInMonth,
		isClient,
		sameDate
	} from './coach';

	let { data, form }: PageProps = $props();

	const clientView = $derived(isClient(data));

	// Preserves the current type/package/date/startsAt query params on submit
	// — a bare `action="?/request"` would replace the whole query string.
	const requestActionUrl = $derived(
		`${page.url.pathname}${page.url.search}${page.url.search ? '&' : '?'}/request`
	);
	const buyActionUrl = $derived(
		`${page.url.pathname}${page.url.search}${page.url.search ? '&' : '?'}/buy`
	);

	let selectedOfferingId = $state<string | null>(null);
	let buying = $state(false);
	let buyNetworkError = $state(false);
	const enhanceBuy: SubmitFunction = () => {
		buying = true;
		buyNetworkError = false;
		return async ({ result, update }) => {
			if (isNetworkFailure(result)) {
				buying = false;
				buyNetworkError = true;
				return;
			}
			await update();
			buying = false;
		};
	};

	let requesting = $state(false);
	let requestNetworkError = $state(false);
	const enhanceRequest: SubmitFunction = () => {
		requesting = true;
		requestNetworkError = false;
		return async ({ result, update }) => {
			if (isNetworkFailure(result)) {
				requesting = false;
				requestNetworkError = true;
				return;
			}
			await update();
			requesting = false;
		};
	};
	const priceCents = $derived(cheapestPackagePriceCents(data.packages));
	const shareUrl = $derived(data.shareUrl);

	let copied = $state(false);
	let copyFailed = $state(false);
	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
		} catch {
			// Clipboard access is denied or unavailable (insecure context, permissions).
			copyFailed = true;
		}
		setTimeout(() => {
			copied = false;
			copyFailed = false;
		}, 1500);
	};

	const dateOptions = $derived(enumerateDateRange(data.today, data.rangeEnd, data.coach.timezone));
	const selectedStartsAt = $derived(page.url.searchParams.get('startsAt'));

	// The month currently shown follows whichever date is selected — no
	// separate `?month=` param needed.
	const viewedMonth = $derived({ year: data.selectedDate.year, month: data.selectedDate.month });
	const monthDays = $derived(daysInMonth(dateOptions, viewedMonth.year, viewedMonth.month));
	const prevMonth = $derived(adjacentMonth(viewedMonth.year, viewedMonth.month, -1));
	const nextMonth = $derived(adjacentMonth(viewedMonth.year, viewedMonth.month, 1));
	const canGoPrevMonth = $derived(hasDayInMonth(dateOptions, prevMonth.year, prevMonth.month));
	const canGoNextMonth = $derived(hasDayInMonth(dateOptions, nextMonth.year, nextMonth.month));
	const showMonthNav = $derived(canGoPrevMonth || canGoNextMonth);

	let note = $state('');

	const updateUrl = (updates: Record<string, string | null>) => {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (value === null) url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		goto(url, { keepFocus: true, noScroll: true });
	};

	const setSessionType = (type: string) =>
		updateUrl({
			type: type === '1:1 in-person' ? null : type,
			package: null,
			date: null,
			startsAt: null
		});

	const setPackage = (purchaseId: string) => updateUrl({ package: purchaseId, date: null, startsAt: null });

	const setDate = (date: { year: number; month: number; day: number }) =>
		updateUrl({ date: dateParamValue(date), startsAt: null });

	const setStartsAt = (iso: string) => updateUrl({ startsAt: iso });

	const goToMonth = (year: number, month: number) => {
		const firstDayInMonth = dateOptions.find((d) => d.year === year && d.month === month);
		if (firstDayInMonth) setDate(firstDayInMonth);
	};
</script>

{#snippet rateAndLocationCards()}
	<div class="grid grid-cols-2 gap-4">
		<div class="bg-base-200 rounded-2xl p-4">
			<div class="text-base-content/60 text-sm">rate</div>
			<div class="text-lg font-medium">
				{priceCents !== null ? `from ${formatPriceCents(priceCents)} per session` : 'no packages yet'}
			</div>
		</div>
		<div class="bg-base-200 rounded-2xl p-4">
			<div class="text-base-content/60 text-sm">trains at</div>
			<div class="text-lg font-medium">{data.coach.locations.join(' · ')}</div>
		</div>
	</div>
{/snippet}

{#snippet shareLinkBox()}
	<div class="bg-base-200 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
		<span class="min-w-0 flex-1 font-mono text-sm break-all">{shareUrl}</span>
		<button
			type="button"
			class="btn btn-sm border-base-300 bg-base-100 text-base-content/60 shrink-0 font-normal"
			onclick={copyLink}
		>
			{copied ? 'copied' : copyFailed ? "couldn't copy" : 'copy link'}
		</button>
	</div>
{/snippet}

{#snippet openHoursList()}
	<div>
		<div class="text-base-content/60 text-xs tracking-wide uppercase">open hours</div>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each data.openHours as window (window.startMin)}
				<span class="badge badge-lg bg-base-200 border-none font-mono">
					{formatMinuteRange(window.startMin, window.endMin)}
				</span>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet sessionTypePicker()}
	<div>
		<div class="text-base-content/60 mb-2 text-sm">session type</div>
		<div class="flex flex-wrap gap-2">
			{#each SESSION_TYPES as type (type)}
				{#if data.allowedTypes.includes(type)}
					<button
						type="button"
						class="btn btn-sm rounded-full font-normal {data.sessionType === type
							? 'btn-neutral'
							: 'border-base-300 bg-base-100 text-base-content/70'}"
						onclick={() => setSessionType(type)}
					>
						{type}
					</button>
				{:else}
					<span
						class="btn btn-sm border-base-300 bg-base-100 text-base-content/30 rounded-full font-normal line-through"
						aria-disabled="true"
						title={!data.parqSubmitted
							? "not submitted a health screening yet — only free consult until then"
							: 'this coach is in a different timezone — only remote-friendly types'}
					>
						{type}
					</span>
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

{#snippet packagePicker()}
	{#if data.sessionType !== 'free consult'}
		{#if form?.boughtPackage}
			<p class="text-success text-sm">
				{form.boughtPackage} purchased — pick a date and time below to request your session.
			</p>
		{/if}
		{#if data.activePackages.length === 0}
			<div class="bg-base-200 flex flex-col gap-3 rounded-2xl p-4">
				<p class="text-sm">
					you need a {data.coach.name.split(' ')[0]} package to book a session. pick one to get started.
				</p>
				{#if data.purchaseBlockReason}
					<p class="text-warning text-sm">{data.purchaseBlockReason}</p>
				{/if}
				{#if data.packages.length > 0}
					<ul class="flex flex-col gap-2">
						{#each data.packages as pkg (pkg.id)}
							{@const selected = selectedOfferingId === pkg.id}
							<li
								class="bg-base-100 hover:border-accent flex flex-col gap-3 rounded-field border p-3 {selected
									? 'border-accent'
									: 'border-base-300'}"
							>
								<button
									type="button"
									class="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
									aria-pressed={selected}
									onclick={() => (selectedOfferingId = selected ? null : pkg.id)}
								>
									<span class="min-w-0">
										<span class="block text-sm font-medium">{pkg.name}</span>
										<span class="text-base-content/60 block text-xs">
											{pkg.sessionCount} × {pkg.sessionLengthMin}-min sessions · valid {pkg.validityDays} days
										</span>
									</span>
									<span class="font-headings shrink-0 text-lg">
										{formatPriceCents(pkg.sessionCount * pkg.pricePerSessionCents)}
									</span>
								</button>
								{#if selected}
									<form method="POST" action={buyActionUrl} use:enhance={enhanceBuy}>
										<input type="hidden" name="packageId" value={pkg.id} />
										{#if form?.message}
											<p class="text-error mb-2 text-sm">{form.message}</p>
										{/if}
										{#if buyNetworkError}
											<p class="text-error mb-2 text-sm">{NETWORK_ERROR_MESSAGE}</p>
										{/if}
										<button
											type="submit"
											class="btn btn-accent btn-sm w-full"
											disabled={buying || !!data.purchaseBlockReason}
										>
											{buying ? 'buying…' : 'buy this package'}
										</button>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<div>
				<div class="text-base-content/60 mb-2 text-sm">package</div>
				<div class="flex flex-wrap items-center gap-2">
					{#each data.activePackages as pkg (pkg.purchaseId)}
						<span class="inline-flex items-center gap-1">
							<button
								type="button"
								class="btn btn-sm rounded-full font-normal {data.selectedPurchase?.purchaseId ===
								pkg.purchaseId
									? 'btn-neutral'
									: 'border-base-300 bg-base-100 text-base-content/70'}"
								onclick={() => setPackage(pkg.purchaseId)}
							>
								{pkg.packageName} · {pkg.bookable} left
							</button>
							{#if pkg.holds > 0}
								<span
									class="tooltip text-base-content/40 cursor-help text-xs"
									data-tip="{pkg.balance} total · {pkg.holds} pending elsewhere · {pkg.bookable} available now"
								>
									ⓘ
								</span>
							{/if}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet datePicker()}
	<div>
		<div class="mb-2 flex items-center justify-between">
			<div class="text-base-content/60 text-sm">date</div>
			{#if showMonthNav}
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="btn btn-ghost btn-xs btn-circle"
						disabled={!canGoPrevMonth}
						onclick={() => goToMonth(prevMonth.year, prevMonth.month)}
						aria-label="previous month"
					>
						<ChevronLeftIcon className="h-3 w-3" />
					</button>
					<span class="text-sm font-light">
						{monthYearLabel(dateForParts(monthDays[0] ?? data.selectedDate, data.coach.timezone), data.coach.timezone)}
					</span>
					<button
						type="button"
						class="btn btn-ghost btn-xs btn-circle"
						disabled={!canGoNextMonth}
						onclick={() => goToMonth(nextMonth.year, nextMonth.month)}
						aria-label="next month"
					>
						<ChevronRightIcon className="h-3 w-3" />
					</button>
				</div>
			{/if}
		</div>
		<div class="flex gap-2 overflow-x-auto pb-1">
			{#each monthDays as date (dateParamValue(date))}
				<button
					type="button"
					class="btn flex h-auto shrink-0 flex-col gap-0 rounded-field py-1.5 font-normal {sameDate(
						data.selectedDate,
						date
					)
						? 'btn-neutral'
						: 'border-base-300 bg-base-100 text-base-content/70'}"
					onclick={() => setDate(date)}
				>
					<span class="text-[10px] opacity-70"
						>{weekdayAbbrev(dateForParts(date, data.coach.timezone), data.coach.timezone)}</span
					>
					<span class="font-headings text-lg">{date.day}</span>
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet timePicker()}
	<div>
		<div class="text-base-content/60 mb-2 text-sm">
			time · {data.coach.name.split(' ')[0]} fits {data.durationMin}-min starts here
		</div>
		{#if data.slots.length === 0}
			<p class="text-base-content/60 text-sm">no open starts this day — try another date.</p>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each data.slots as slot (slot.start.toISOString())}
					{#if slot.available}
						<button
							type="button"
							class="btn btn-sm rounded-full font-mono font-normal {selectedStartsAt ===
							slot.start.toISOString()
								? 'btn-neutral'
								: 'border-base-300 bg-base-100 text-base-content/70'}"
							onclick={() => setStartsAt(slot.start.toISOString())}
						>
							{formatTime(slot.start, data.coach.timezone)}
						</button>
					{:else}
						<span
							class="btn btn-sm border-base-300 bg-base-100 text-base-content/30 rounded-full font-mono font-normal line-through"
							aria-disabled="true"
						>
							{formatTime(slot.start, data.coach.timezone)}
						</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet locationField()}
	{#if data.sessionType !== '1:1 online' && data.coach.locations.filter((l) => l !== 'online').length > 0}
		<div>
			<label class="text-base-content/60 mb-2 block text-sm" for="location">location</label>
			<select id="location" name="location" class="select select-bordered w-full">
				{#each data.coach.locations.filter((l) => l !== 'online') as location (location)}
					<option value={location}>{location}</option>
				{/each}
			</select>
		</div>
	{/if}
{/snippet}

{#snippet summaryBar()}
	{#if selectedStartsAt}
		<div class="bg-base-200 flex items-center justify-between gap-3 rounded-2xl p-4 text-sm">
			<span>
				{data.sessionType} · {weekdayAbbrev(new Date(selectedStartsAt), data.coach.timezone)}
				{dayNumber(new Date(selectedStartsAt), data.coach.timezone)} · {formatTime(
					new Date(selectedStartsAt),
					data.coach.timezone
				)}
			</span>
			<span class="font-medium">
				{data.sessionType === 'free consult' ? 'free' : '1 session'}
			</span>
		</div>
	{/if}
{/snippet}

{#snippet requestForm()}
	<form
		method="POST"
		action={requestActionUrl}
		class="flex flex-col gap-6"
		use:enhance={enhanceRequest}
	>
		{@render locationField()}

		<div>
			<label class="text-base-content/60 mb-2 block text-sm" for="note">anything i should know?</label>
			<textarea
				id="note"
				name="note"
				bind:value={note}
				class="textarea textarea-bordered w-full"
				placeholder="niggling left knee this week — happy to swap lunges"
			></textarea>
		</div>

		{@render summaryBar()}

		{#if form?.message}
			<p class="text-error text-sm">{form.message}</p>
		{/if}
		{#if requestNetworkError}
			<p class="text-error text-sm">{NETWORK_ERROR_MESSAGE}</p>
		{/if}

		<button type="submit" class="btn btn-accent w-full" disabled={!selectedStartsAt || requesting}>
			{requesting ? 'sending…' : 'send request'}
		</button>
	</form>
{/snippet}

<div class="mx-auto max-w-3xl p-6 md:p-10">
	<div class="bg-base-100 border-base-300 flex flex-col gap-6 rounded-2xl border p-6 md:p-8">
		<a
			href="/bookings"
			class="text-base-content/70 hover:text-base-content flex w-fit items-center gap-1 text-sm"
		>
			<ChevronLeftIcon className="h-3 w-3" />
			all coaches
		</a>

		{#if clientView}
			<CoachHeader name={data.coach.name} tagline={data.coach.tagline} tags={data.coach.tags} />
			{@render rateAndLocationCards()}

			<p class="text-base-content/80">{data.coach.bio}</p>

			{@render shareLinkBox()}
			{@render openHoursList()}

			<div class="border-base-300 flex flex-col gap-6 border-t pt-6">
				<div>
					<h2 class="font-headings text-2xl">book {data.coach.name.split(' ')[0]}</h2>
					<p class="text-base-content/60 text-sm">
						you're asking for a slot, not taking it. your coach approves, then it's locked in.
					</p>
				</div>

				{@render sessionTypePicker()}
				{@render packagePicker()}

				{#if data.durationMin}
					{@render datePicker()}
					{@render timePicker()}
					{@render requestForm()}
				{/if}
			</div>
		{:else}
			<p class="text-base-content/60 max-w-sm">
				the {data.user.role} portal is coming soon — your tools will live here.
			</p>
		{/if}
	</div>
</div>
