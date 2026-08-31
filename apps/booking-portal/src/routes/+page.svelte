<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '@repo/ui';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
    import type { SignupErrorValues } from './+page.server';

	let { form }: PageProps = $props();

	// seeded once from the server-rendered `form` (only relevant on a no-JS full-page reload)
	let mode = $state<'login' | 'signup'>(untrack(() => (form?.mode === 'signup' ? 'signup' : 'login')));

	let email = $state(untrack(() => form?.values?.email ?? ''));
	let password = $state('');
	let keepLoggedIn = $state(true);

	let firstName = $state(untrack(() => (form?.mode === 'signup' ? (form.values?.firstName ?? '') : '')));
	let middleName = $state(untrack(() => (form?.mode === 'signup' ? (form.values?.middleName ?? '') : '')));
	let lastName = $state(untrack(() => (form?.mode === 'signup' ? (form.values?.lastName ?? '') : '')));
	let agreedToTerms = $state(false);

	const copy = $derived(
		mode === 'login'
			? {
					heading: 'welcome back.',
					subheading: 'log in to manage your sessions.',
					submitLabel: 'log in',
					switchLabel: 'new here? create an account'
				}
			: {
					heading: "let's get you started.",
					subheading: 'two minutes now, then health screening before your first session.',
					submitLabel: 'create account',
					switchLabel: 'i already have an account'
				}
	);

	const errors = $derived(mode === form?.mode ? (form?.errors ?? {}) : {});

	function switchMode() {
		mode = mode === 'login' ? 'signup' : 'login';
	}
</script>

<div class="grid h-full w-full grid-cols-1 md:grid-cols-2">
	<div class="bg-neutral text-neutral-content flex flex-col justify-between gap-8 p-8 md:p-12">
		<p class="font-body text-neutral-content/70 text-sm tracking-widest">
			training@<span class="text-neutral-content font-bold">builtwithhabit</span>
		</p>

		<div class="flex flex-col gap-6">
			<h1 class="font-headings text-4xl leading-tight md:text-5xl">
				sweat smarter,<br />
				<span class="text-accent italic">live stronger.</span>
			</h1>

			<p class="font-body text-neutral-content/70 max-w-sm text-base md:text-lg">
				your sessions, your packages and your progress — all in one place. request a slot, we'll
				confirm it.
			</p>
		</div>

		<div
			class="border-neutral-content/10 relative flex h-40 items-center justify-center overflow-hidden rounded-box border"
			style="background-image: repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-neutral-content) 10%, transparent) 0 12px, transparent 12px 24px);"
		>
			<p class="font-body text-neutral-content/50 text-sm tracking-wide">gym / lifestyle photo</p>
		</div>
	</div>

	<div class="bg-base-100 flex items-center justify-center p-8 md:p-12">
		<form
			class="flex w-full max-w-sm flex-col gap-6"
			method="POST"
			action={mode === 'login' ? '?/login' : '?/signup'}
			use:enhance
		>
			<div class="flex flex-col gap-1">
				<h2 class="font-headings text-base-content text-4xl">{copy.heading}</h2>
				<p class="font-body text-base-content/60">{copy.subheading}</p>
			</div>

			<div class="flex flex-col gap-4">
				{#if mode === 'signup'}
				    {@const signupErrors = errors as SignupErrorValues}
					<div class="grid grid-cols-2 gap-4">
						<label class="flex flex-col gap-1" for="firstName">
							<span class="font-body text-base-content/70 text-sm">first name</span>
							<input
								id="firstName"
								name="firstName"
								type="text"
								placeholder="ishita"
								class="input w-full"
								class:input-error={signupErrors.firstName}
								bind:value={firstName}
								required
							/>
							{#if signupErrors.firstName}
								<span class="text-error text-xs">{signupErrors.firstName[0]}</span>
							{/if}
						</label>

						<label class="flex flex-col gap-1" for="lastName">
							<span class="font-body text-base-content/70 text-sm">last name</span>
							<input
								id="lastName"
								name="lastName"
								type="text"
								placeholder="mahajan"
								class="input w-full"
								class:input-error={signupErrors.lastName}
								bind:value={lastName}
								required
							/>
							{#if signupErrors.lastName}
								<span class="text-error text-xs">{signupErrors.lastName[0]}</span>
							{/if}
						</label>
					</div>

					<label class="flex flex-col gap-1" for="middleName">
						<span class="font-body text-base-content/70 text-sm">
							middle name <span class="text-base-content/40">(optional)</span>
						</span>
						<input
							id="middleName"
							name="middleName"
							type="text"
							placeholder="priya"
							class="input w-full"
							bind:value={middleName}
						/>
					</label>
				{/if}

				<label class="flex flex-col gap-1" for="email">
					<span class="font-body text-base-content/70 text-sm">email</span>
					<input
						id="email"
						name="email"
						type="email"
						placeholder="you@example.com"
						class="input w-full"
						class:input-error={errors.email}
						bind:value={email}
						required
					/>
					{#if errors.email}
						<span class="text-error text-xs">{errors.email[0]}</span>
					{/if}
				</label>

				<label class="flex flex-col gap-1" for="password">
					<span class="font-body text-base-content/70 text-sm">password</span>
					<input
						id="password"
						name="password"
						type="password"
						placeholder={mode === 'signup' ? 'at least 8 characters' : '••••••••'}
						class="input w-full"
						class:input-error={errors.password}
						bind:value={password}
						minlength={mode === 'signup' ? 8 : undefined}
						required
					/>
					{#if errors.password}
						<span class="text-error text-xs">{errors.password[0]}</span>
					{/if}
				</label>
			</div>

			{#if mode === 'login'}
				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="keepLoggedIn"
							class="checkbox checkbox-primary"
							bind:checked={keepLoggedIn}
						/>
						<span class="font-body text-base-content/80 text-sm">keep me logged in</span>
					</label>

					<a href="/forgot-password" class="font-body text-accent text-sm hover:underline">
						forgot password?
					</a>
				</div>
			{:else}
				{@const signupErrors = errors as SignupErrorValues}
				<label class="flex items-start gap-2">
					<input
						type="checkbox"
						name="agreedToTerms"
						class="checkbox checkbox-primary mt-0.5"
						bind:checked={agreedToTerms}
						required
					/>
					<span class="font-body text-base-content/80 text-sm">
						i agree to the terms, privacy notice and the 24-hour cancellation policy.
					</span>
				</label>
				{#if signupErrors.agreedToTerms}
					<span class="text-error text-xs">{signupErrors.agreedToTerms[0]}</span>
				{/if}
			{/if}

			<div class="flex flex-col gap-3">
				<Button type="submit" variant="accent" class="text-accent-content w-full">
					{copy.submitLabel}
				</Button>
				<Button variant="outline" class="w-full" onclick={switchMode}>
					{copy.switchLabel}
				</Button>
			</div>

			{#if mode === 'login'}
				<p class="font-body text-base-content/50 text-xs">
					by logging in you agree to our terms and privacy notice. health information you share is
					handled under singapore's pdpa.
				</p>
			{/if}
		</form>
	</div>
</div>
