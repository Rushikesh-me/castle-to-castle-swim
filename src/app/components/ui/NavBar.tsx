"use client";

import { useState } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Button } from "./button";

const NavBar = () => {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	// Function to close mobile menu when a link is clicked
	const handleLinkClick = () => {
		setMobileMenuOpen(false);
	};

	return (
		<header className="bg-white z-[99] w-full fixed top-0 border-b-2 border-border">
			<nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 lg:px-4">
				<div className="flex lg:flex-1">
					<Link href="/" className="-m-1.5 p-1.5">
						<span className="sr-only">CastleSwim</span>
						<img alt="CastleSwim Logo" src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/X1LQYi2rEkolCwaxzST4/media/644eaaf7208b4e2264148088.png" className="h-16 w-auto" />
					</Link>
				</div>
				<div className="flex lg:hidden">
					<button 
						type="button" 
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
						className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
					>
						<span className="sr-only">{mobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
						{mobileMenuOpen ? (
							<XMarkIcon aria-hidden="true" className="h-6 w-6" />
						) : (
							<Bars3Icon aria-hidden="true" className="h-6 w-6" />
						)}
					</button>
				</div>
				<div className="hidden lg:flex lg:gap-x-12">
					<Link href="/" className="text-sm font-semibold leading-6 text-gray-900">
						Map
					</Link>
					<Link href="/leaderboards" className="text-sm font-semibold leading-6 text-gray-900">
						Leaderboards
					</Link>
				</div>
				<div className="hidden lg:flex lg:flex-1 lg:justify-end">
					<Button 
						variant="outline" 
						onClick={() => window.open("https://www.idonate.ie/event/castletocastle25", "_blank")} 
						className="bg-primary font-semibold text-lg text-white hover:bg-primary/80 hover:text-white"
					>
						Donate
					</Button>
				</div>
			</nav>
			
			{/* Mobile Menu */}
			<Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
				<div className="fixed inset-0 z-10" />
				<DialogPanel className="fixed inset-y-0 right-0 z-10 flex w-full flex-col justify-between overflow-y-auto bg-white sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
					<div className="p-6">
						<div className="flex items-center justify-between">
							<Link href="/" className="-m-1.5 p-1.5" onClick={handleLinkClick}>
								<span className="sr-only">CastleSwim</span>
								<img alt="CastleSwim Logo" src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/X1LQYi2rEkolCwaxzST4/media/644eaaf7208b4e2264148088.png" className="h-8 w-auto" />
							</Link>
							<button 
								type="button" 
								onClick={() => setMobileMenuOpen(false)} 
								className="-m-2.5 rounded-md p-2.5 text-gray-700"
							>
								<span className="sr-only">Close menu</span>
								<XMarkIcon aria-hidden="true" className="h-6 w-6" />
							</button>
						</div>
						<div className="mt-6 flow-root">
							<div className="-my-6 divide-y divide-gray-500/10">
								<div className="space-y-2 py-6">
									<Link 
										href="/" 
										className="block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
										onClick={handleLinkClick}
									>
										Map
									</Link>
									<Link 
										href="/leaderboards" 
										className="block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
										onClick={handleLinkClick}
									>
										Leaderboards
									</Link>
								</div>
							</div>
						</div>
					</div>
					<div className="sticky bottom-0 bg-gray-50 text-center p-4">
						<Button 
							variant="outline" 
							onClick={() => {
								window.open("https://www.idonate.ie/event/castletocastle25", "_blank");
								setMobileMenuOpen(false);
							}} 
							className="w-full bg-primary font-semibold text-lg text-white hover:bg-primary/80 hover:text-white"
						>
							Donate
						</Button>
					</div>
				</DialogPanel>
			</Dialog>
		</header>
	);
}

export default NavBar;
