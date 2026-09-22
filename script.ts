import { Annotation, AnnotationBody, createTextAnnotator, HighlightStyle, TextAnnotation } from '@recogito/text-annotator';
import '@recogito/text-annotator/text-annotator.css';

import '@material/web/elevation/elevation.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/textfield/filled-text-field.js';
// import { createHash } from 'crypto';

new Image().src = 'images/bg.webp'; // preload background image
new Image().src = 'images/skyline.svg'
// Type definitions
// interface Annotation {
//     id: string;
//     bodies?: Array<{
//         text?: string;
//         sent?: boolean;
//     }>;
//     target: {
//         selector: Array<{
//             range: {
//                 startContainer: {
//                     parentElement: HTMLElement;
//                 };
//             };
//         }>;
//     };
// }

// dirty hack 2
document.querySelectorAll('.loader-container, .loading').forEach((el: Element): void => {
    console.log('loader clicked')
    document.body.classList.remove('loading');
})

setTimeout(() => {
    if (document.body.classList.contains('loading')) {
        console.log('loader timeout')
        document.body.classList.remove('loading');
    }
}, 2500)


// Global variables
let confettiLoaded: boolean = false;
let confettiLoadingPromise: Promise<void> | null = null;

let masterWiggleStrength = 1;

declare global {
    interface Window {
        confetti: (options: any) => void;
        closeNav: () => void;
        submitComment: () => void;
    }
}

type Override<T, R> = Omit<T, keyof R> & R;



interface CustomBody {
    sent?: boolean;
    text?: string;
}

interface AnnotationState {
    hovered?: boolean;
}

// Main JavaScript functionality for changeyourname.mn
document.addEventListener('DOMContentLoaded', (): void => {
    // grab the skyline svg and inline it
    let skylineLoaded = false;
    fetch("/images/skyline.svg")
        .then(r => r.text())
        .then(svg => {
            (document.querySelector("#skyline") as SVGElement).outerHTML = svg;
            skylineLoaded = true;
        });


    document.fonts.ready.then((): void => {


        document.querySelectorAll('[umami-track-vis]').forEach((el: Element): void => {

            const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]): void => {
                entries.forEach((entry: IntersectionObserverEntry): void => {
                    if (entry.isIntersecting) {
                        const eventName = 'scrolled-to--' + (el as HTMLElement).id || 'generic-el-scrolled-into-view';
                        umami.track(eventName);
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0
            });
            observer.observe(el);

        });


        // const hash = fnv1a(document.body.innerText);
        // console.log(document.body.innerText, hash);
        // TODO: verify hash of page contents to ensure integrity of annotations, and to prevent loading annotations on an outdated version
        // of the page that may have different content and thus different annotation offsets. This is a naiive approach I think

        // load from local storage
        // const savedAnnotations: Annotation[] = JSON.parse(localStorage.getItem('annotations') || '[]');
        // savedAnnotations.forEach((annotation: Annotation) => anno.addAnnotation(annotation as any));


        // if (document.body.clientWidth < 768) {
        //     document.querySelector('.header-card svg')?.setAttribute('viewBox', "0,0,1000,200")
        // }

        let FPS = 7;
        let timeScalar = 1;
        let wiggleStrength = 5

        // we apply a few different techniques to make this look nice on mobile
        if (document.body.clientWidth < 768) {
            // tone down the noise (there seems to be a difference chrome v safari)
            document.querySelector('#speckleNoise')?.setAttribute('baseFrequency', ".08");
            FPS = 15
            // timeScalar = .75
            // wiggle less
            wiggleStrength = 3
        }

        // // start with header card content hidden
        // (document.querySelector('.header-card h2') as HTMLElement).style.opacity = "0";

        // document.querySelectorAll('.header-card .sub-card').forEach((el => {
        //     (el as HTMLElement).style.opacity = "0";
        // }))

        // document.querySelectorAll('.options .option').forEach((el: any) => {
        //     console.log(el)
        //     el = el as HTMLElement;
        //     el.style.opacity = 0;
        // });


        // wiggle the landing text
        wiggle(document.querySelector('svg .one'), 1, wiggleStrength, FPS)
        wiggle(document.querySelector('svg .two'), 1, wiggleStrength, FPS)
        wiggle(document.querySelector('svg .three'), 1, wiggleStrength, FPS)

        // // fade in content
        // setTimeout(() => {
        //     document.querySelectorAll('.options .option').forEach((el: any) => {
        //         fadeIn(el, { duration: 3000, fps: 60 })
        //     });
        //     fadeIn(document.querySelector('.header-card h2'), { duration: 3000, fps: 60 });
        //     document.querySelectorAll('.header-card .sub-card').forEach((el: any) => {

        //         fadeIn(el, { duration: 3000, fps: 60 });
        //     });
        // }, 2000);


        const startFps = 5;
        const endFps = 1;
        const noiseDuration = 10000; // time to slow down (ms)
        const noiseStartTime = performance.now();
        function animateNoise() {
            const now = performance.now();
            const elapsed = now - noiseStartTime;

            // 0 -> 1 over duration
            const t = Math.min(elapsed / noiseDuration, 1);

            // interpolate FPS
            const fps = startFps + (endFps - startFps) * t;
            // if (Math.abs(endFps - fps) < 0.001) {
            //     return
            // }

            document.querySelector('#skylineSeed')
                ?.setAttribute('seed', (Math.random() * 1000000).toString());

            // schedule next frame
            setTimeout(animateNoise, 1000 / fps);
        }

        animateNoise();

        // animate print effect 
        const thresholdEl1 = document.querySelector('#headerThreshold1');
        const blurEl1 = document.querySelector('#headerBlur1');
        const thresholdEl2 = document.querySelector('#headerThreshold2');
        const blurEl2 = document.querySelector('#headerBlur2');
        const thirdText = document.querySelector('g.three text')
        let firstTime = true;

        if (!thresholdEl1 || !blurEl1 || !thresholdEl2 || !blurEl2) {
            console.error('Target elements not found.');
            return;
        }

        const duration = 3000; // Duration in milliseconds
        const startTime = performance.now();

        // Ease-in-out quadratic function
        const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        let lastTime = performance.now();
        const animate = (currentTime: number) => {
            let elapsed = (currentTime * timeScalar) - startTime;

            let delta = performance.now() - lastTime
            lastTime = performance.now();

            if (delta > (1000 / 10)) {
                console.log('dropped frame delta: ' + delta + '/100 @ ' + Date.now())

            }

            // console.log(elapsed)
            // if (elapsed < .5) {
            let progress1 = Math.min((Math.max(0, elapsed + 1500)) / duration, 1);
            let progress2 = Math.min((Math.max(0, (elapsed * .75) + 250)) / duration, 1);
            // Apply easing
            // const easedProgress = easeInOut(progress);

            // Calculate interpolated values
            const currentSlope1 = 25 + (40 - 0) * easeInOut(progress1);
            const currentBlur1 = 5 + (.25 - 2) * easeInOut(progress1);

            const currentSlope2 = 0 + (35 - 0) * easeInOut(progress2);
            const currentBlur2 = 2 + (4 - 2) * easeInOut(progress2);

            // Update attributes
            thresholdEl1.setAttribute('slope', currentSlope1.toString());
            blurEl1.setAttribute('stdDeviation', currentBlur1.toString());
            thresholdEl2.setAttribute('slope', currentSlope2.toString());
            blurEl2.setAttribute('stdDeviation', currentBlur2.toString());

            if (firstTime && skylineLoaded) {
                firstTime = false;
                document.body.classList.remove('loading');
            }

            thirdText?.setAttribute('letter-spacing', `${(easeInOut(progress2 - .25)) * .15}em`);




            if (progress2 < 1) {
                setTimeout(() => {
                    requestAnimationFrame(animate);
                }, 1000 / 10);
            }





            // } else {
            // requestAnimationFrame(animate);
            // }


        };

        console.log('initial call')
        requestAnimationFrame(animate);




    });


    const anno = createTextAnnotator(document.querySelector('.content')!, {
        allowModifierSelect: true,
        // dismissOnNotAnnotatable: true,
        selectionMode: 'shortest',
    });

    anno.setStyle((annotation: Annotation, state: AnnotationState): HighlightStyle => ({
        fill: (annotation.bodies?.[0] as CustomBody)?.sent ? '#d3d3d3' : '#a6ff00',
        fillOpacity: state.hovered ? 0.5 : 0.25,
        underlineStyle: 'dashed',
        underlineColor: '#7d7208ff',
        underlineOffset: 0,
        underlineThickness: 2,
    }));


    let isNewAnnotationPending: boolean = false;

    anno.on('selectionChanged', async (annotations: Annotation[]): Promise<void> => {
        console.log('Selection changed:', annotations);
        if (annotations.length === 0) {
            return
        }
        // if ((annotations[0].target.selector as string[]).join('').length > 1000) {
        //     // anno.removeAnnotation(annotations[0] as any)
        //     if (window && window.getSelection) { window.getSelection()?.removeAllRanges(); }
        //     return
        // }

        const customBody = annotations?.[0]?.bodies?.[0] as { text?: string; sent?: boolean };

        if (customBody?.sent) {
            // Handle sent annotations
        }

        // we get this event prior to the annotation actually being rendered in the DOM, so we have to wait a tick and check for the element to exist before proceeding
        await new Promise<void>((resolve): void => {
            const interval = setInterval((): void => {
                if (!!document.querySelector(`[data-annotation="${annotations[0]?.id}"]`)) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 10);

            const timeout = setTimeout((): void => {
                console.warn('timeout waiting for annotation dom');
                clearInterval(interval);
                resolve();
            }, 500);
        });

        if (annotations?.[0]?.bodies?.[0] !== undefined) {
            const textFieldInput = document.querySelector('.annotate-popover md-filled-text-field') as any;
            if (textFieldInput) textFieldInput.value = (annotations[0].bodies[0] as CustomBody).text;
        }

        document.querySelectorAll('.r6o-annotation.selected').forEach((el: Element): void => el.classList.remove('selected'));
        const els = document.querySelectorAll(`[data-annotation="${annotations[0].id}"]`);

        // calculate bounding box for all els with this annotation ID
        let minX: number = Infinity, minY: number = Infinity, maxX: number = -Infinity, maxY: number = -Infinity;
        els.forEach((el: Element): void => {
            el.classList.add('selected');
            const bb = el.getBoundingClientRect();
            minX = Math.min(minX, bb.left);
            minY = Math.min(minY, bb.top);
            maxX = Math.max(maxX, bb.right);
            maxY = Math.max(maxY, bb.bottom);
        });

        const popover = document.querySelector('.annotate-popover') as HTMLElement;
        if (popover) {
            popover.style.display = 'flex';

            // hack
            const offsetWidth: number = 532;
            const offsetHeight: number = 271;

            console.log(popover.offsetWidth, minX, maxX, window.pageXOffset, offsetWidth);
            popover.style.left = `${(minX + maxX) / 2 + window.pageXOffset - (offsetWidth / 2)}px`;
            popover.style.top = `${minY + window.pageYOffset - offsetHeight}px`;
            popover.style.position = 'absolute';

            // if popover goes off screen, move it back on
            if (
                window.innerWidth < 700 ||
                parseInt(popover.style.left.split('px')[0]) < window.pageXOffset ||
                parseInt(popover.style.top.split('px')[0]) < window.pageYOffset ||
                parseInt(popover.style.top.split('px')[0]) + offsetHeight > window.pageYOffset + window.innerHeight ||
                parseInt(popover.style.left.split('px')[0]) + offsetWidth > window.pageXOffset + window.innerWidth
            ) {
                // position in center
                popover.style.position = 'fixed';
                popover.style.left = `${(window.innerWidth / 2) - (offsetWidth / 2)}px`;
                popover.style.top = `${(window.innerHeight / 2)}px`;

                // ensure annotation is in view (not blocked by centered popover)
                const annotationTarget = annotations[0].target.selector[0].range.startContainer.parentElement;
                annotationTarget.style.scrollMarginTop = '-500px';
                if (annotationTarget.textContent.length < 1000) {
                    annotationTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                console.log(annotations);
            }
        }

        const closeIfClickedOutside = (event: Event): void => {
            console.log('Document click:', event.target);
            const popover = document.querySelector('.annotate-popover') as HTMLElement;
            if (popover && !popover.contains(event.target as Node)) {
                closePopover();
            }
        };
        document.addEventListener('click', closeIfClickedOutside);

        function closePopover(): void {
            console.log('Closing popover');
            document.removeEventListener('click', closeIfClickedOutside);

            if (!annotations[0].bodies?.[0]) {
                annotations[0].bodies = [{} as AnnotationBody];
            }

            const textFieldInput = document.querySelector('.annotate-popover md-filled-text-field') as any;
            if (textFieldInput) {
                (annotations[0].bodies[0] as CustomBody).text = textFieldInput.value;
            }

            anno.updateAnnotation(annotations[0] as TextAnnotation);
            isNewAnnotationPending = false;

            const popover = document.querySelector('.annotate-popover') as HTMLElement;
            if (popover) {
                popover.style.display = 'none';
            }

            if (textFieldInput) textFieldInput.value = '';
            anno.cancelSelected();

            // save to localstorage
            const allAnnotations = anno.getAnnotations();
            localStorage.setItem('annotations', JSON.stringify(allAnnotations));
        }

        // listen for x click
        const closeButton = document.querySelector('.annotate-popover .close-popover') as HTMLElement;
        if (closeButton) {
            closeButton.onclick = (): void => {
                anno.removeAnnotation(annotations[0].id);
                closePopover();
            };
        }

        // listen for post note click
        const postNoteButton = document.querySelector('.annotate-popover .post-note') as HTMLElement;
        if (postNoteButton) {
            postNoteButton.onclick = (): void => {
                if ((annotations[0].bodies?.[0] as CustomBody)?.sent) return;

                if (!annotations[0].bodies?.[0]) {
                    annotations[0].bodies = [{} as AnnotationBody];
                }
                const textFieldInput = document.querySelector('.annotate-popover md-filled-text-field') as any;
                if (textFieldInput) {
                    (annotations[0].bodies[0] as CustomBody).text = textFieldInput.value;
                }

                fetch('/comments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ object: annotations[0] })
                })
                    .then((response: Response) => {
                        if (response.ok) {
                            if (!annotations[0].bodies?.[0]) {
                                annotations[0].bodies = [{} as AnnotationBody];
                            }
                            (annotations[0].bodies[0] as CustomBody).sent = true;
                            anno.updateAnnotation(annotations[0] as TextAnnotation);

                            // save to localstorage
                            // const allAnnotations = anno.getAnnotations();
                            anno.removeAnnotation(annotations[0].id);
                            localStorage.setItem('annotations', JSON.stringify(anno.getAnnotations()));
                            closePopover();
                            alert('Suggestion submitted successfully! Thank you :3');
                        } else {
                            failSubmitComment(JSON.stringify(annotations[0]));
                        }
                    })
                    .catch((error: Error) => {
                        console.error('Error:', error);
                        failSubmitComment(JSON.stringify(annotations[0]));
                    });
            };
        }
    });

    // NAVIGATION BAR FUNCTIONALITY
    const menuButton = document.getElementById('menuButton') as HTMLElement;
    const navDrawer = document.getElementById('navDrawer') as HTMLElement;
    const navOverlay = document.getElementById('navOverlay') as HTMLElement;

    function openDrawer(): void {
        navDrawer?.classList.add('open');
        navOverlay?.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer(): void {
        navDrawer?.classList.remove('open');
        navOverlay?.classList.remove('visible');
        document.body.style.overflow = '';
    }

    // Make closeNav available globally for nav links
    window.closeNav = closeDrawer;

    menuButton?.addEventListener('click', openDrawer);
    navOverlay?.addEventListener('click', closeDrawer);

    // Close drawer on Escape key
    document.addEventListener('keydown', (e: KeyboardEvent): void => {
        if (e.key === 'Escape' && navDrawer?.classList.contains('open')) {
            closeDrawer();
        }
    });

    // ASSUMPTIONS CHECKLIST
    document.querySelectorAll('.assumption-item md-checkbox').forEach((checkbox: Element): void => {
        const assumptionId = checkbox.id.replace('assumption-', '');
        const detailsElement = document.getElementById(`details-${assumptionId}`) as HTMLElement;

        (checkbox as any).checked = true; // Ensure checkbox is checked by default

        // Set initial state - details hidden when checked
        if ((checkbox as any).checked && detailsElement) {
            detailsElement.classList.remove('visible');
        }

        // show details when unchecked
        checkbox.addEventListener('change', (e: Event): void => {
            if (detailsElement) {
                if ((e.target as any).checked) {
                    // Hide details when checked
                    detailsElement.classList.remove('visible');
                } else {
                    // Show details when unchecked
                    detailsElement.classList.add('visible');
                }
            }
        });
    });

    // SECTION COLLAPSING
    document.querySelectorAll('.section-header-buttons button.collapse').forEach((button: Element): void => {
        // Initialize the DOM state, just in case the section is not collapsed
        button.setAttribute('aria-expanded', 'false');
        const icon = button.querySelector('.material-symbols-outlined') as HTMLElement;
        if (icon) icon.textContent = 'expand_less';
        button.setAttribute('aria-expanded', 'true');

        button.closest('.guide-section')?.classList.remove('collapsed');
        const content = button.closest('.guide-section')?.querySelector('.section-content') as HTMLElement;
        content?.classList.remove('collapsed');

        button.addEventListener('click', (): void => {
            const section = button.closest('.guide-section') as HTMLElement;
            const content = section?.querySelector('.section-content') as HTMLElement;

            section?.classList.toggle('collapsed');
            content?.classList.toggle('collapsed');
            const isCollapsed = content?.classList.contains('collapsed');

            // Toggle the section content visibility
            const icon = button.querySelector('.material-symbols-outlined') as HTMLElement;
            if (icon) {
                icon.textContent = isCollapsed ? 'expand_more' : 'expand_less';
            }

            if (isCollapsed) {
                button.setAttribute('aria-expanded', 'false');
            } else {
                button.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // SECTION DONE BUTTONS
    document.querySelectorAll('.section-header-buttons button.done').forEach((button: Element): void => {
        button.addEventListener('click', (): void => {
            const icon = button.querySelector('.material-symbols-outlined') as HTMLElement;
            if (icon) {
                const txt = icon.textContent;
                icon.textContent = txt === 'check' ? 'done_outline' : 'check';
            }
        });
    });

    // Save and load functionality for form elements
    document.querySelectorAll('.saveable').forEach((element: Element): void => {
        element.classList.add('not-annotatable')

        // Load saved value from localStorage or cookies
        const savedValue = load(element.id) === 'true';

        // Apply the saved value to the element
        (element as any).value = savedValue;
        (element as any).checked = savedValue ? 'checked' : '';

        // update nav bar
        updateNavCheckmark(element.id, savedValue);

        if (element.tagName === 'INPUT') {
            element.addEventListener('change', (): void => {
                // Save the value when it changes
                save(element as HTMLInputElement);
                playClick();
                updateNavCheckmark(element.id, (element as HTMLInputElement).checked);
            });
        } else if (element.tagName === 'MD-CHECKBOX') {
            function hideSection(element: Element) {
                let btn = (document.querySelector(`#${element.id}`)?.closest('.section-header-buttons')?.querySelector('button.collapse') as HTMLButtonElement)
                console.log(btn, btn.getAttribute('aria-expanded'));
                if (btn.getAttribute('aria-expanded') === 'true' || btn.getAttribute('aria-expanded') === null) btn.click()
                console.log(btn.getAttribute('aria-expanded'));
            }

            if ((element as any).checked) hideSection(element);


            element.addEventListener('change', (): void => {
                // Save the value when it changes
                save(element.id, (element as any).checked);
                playClick();
                updateNavCheckmark(element.id, (element as any).checked);
                if ((element as any).checked) hideSection(element);
            });
        }
    });

    // Play click sound
    function playClick(): void {
        const audio = new Audio('resources/click.mp3');
        audio.play();
    }

    // Update nav bar checkmarks based on checkbox state
    function updateNavCheckmark(checkboxId: string, isChecked: boolean): void {
        // Convert checkbox ID to nav ID (e.g., "introduction-checkbox" -> "introduction-nav")
        const navId = checkboxId.replace('-checkbox', '-nav');
        const navItem = document.getElementById(navId) as HTMLElement;

        if (navItem) {
            // Find or create the checkmark icon
            let checkmark = navItem.querySelector('.nav-checkmark') as HTMLElement;

            if (isChecked) {
                // Add checkmark if it doesn't exist
                if (!checkmark) {
                    checkmark = document.createElement('span');
                    checkmark.className = 'material-symbols-outlined nav-checkmark';
                    checkmark.textContent = 'check_circle';
                    checkmark.setAttribute('aria-hidden', 'true');
                    navItem.appendChild(checkmark);
                }
            } else {
                // Remove checkmark if it exists
                if (checkmark) {
                    checkmark.remove();
                }
            }
        }
    }



    // Smooth scrolling for anchor links with nav bar offset
    document.addEventListener('click', (e: Event): void => {
        // Check if the clicked element or its parent is an anchor with hash
        const link = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement;
        if (link) {
            const href = link.getAttribute('href');
            if (!href) return;

            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId) as HTMLElement;

            if (targetElement && targetId) {
                // Prevent all default behaviors
                e.preventDefault();

                // Calculate offset for sticky nav bar
                const appBar = document.querySelector('.app-bar') as HTMLElement;
                const offset = appBar ? appBar.offsetHeight + 24 : 100; // 24px extra padding

                // Close navigation drawer if open
                if (navDrawer && navDrawer.classList.contains('open')) {
                    closeDrawer();
                }

                // Wait a tiny bit for nav drawer to start closing, then scroll
                setTimeout((): void => {
                    // Get the target position
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - offset;

                    // Smooth scroll to position
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }, 50);
            }
        }
    });

    // Celebration Button Functionality
    const celebrationButtons = document.querySelectorAll('.celebration-button') as NodeListOf<HTMLElement>;

    navigator.mediaSession.setActionHandler('play', (): void => { });
    navigator.mediaSession.setActionHandler('pause', (): void => { });
    navigator.mediaSession.setActionHandler('seekbackward', (): void => { });
    navigator.mediaSession.setActionHandler('seekforward', (): void => { });
    navigator.mediaSession.setActionHandler('previoustrack', (): void => { });
    navigator.mediaSession.setActionHandler('nexttrack', (): void => { });

    let audio: HTMLAudioElement | undefined;
    let audioID: string | undefined;

    if (celebrationButtons) {
        celebrationButtons.forEach((button: HTMLElement): void => {
            button.addEventListener('click', async (): Promise<void> => {
                // if audio has been playing from another button, stop it
                if (audioID !== button.getAttribute('audioID')) {
                    audio?.pause();
                    audio = undefined;

                    audioID = button.getAttribute('audioID') || '';
                    audio = new Audio(`resources/celebrate-${audioID}.mp3`);
                }

                // if audio is not playing, start
                if (audio && audio.paused) {
                    audio.currentTime = 0;
                    audio.play();

                    // Add celebration animation
                    button.classList.add('celebrating');

                    // Remove animation class after animation completes
                    setTimeout((): void => {
                        button.classList.remove('celebrating');
                    }, 600);

                    // Load confetti library and create confetti effect
                    try {
                        await loadConfettiLibrary();
                        fireConfetti();
                    } catch (error) {
                        console.warn('Failed to load confetti library:', error);
                    }

                    const moreConfetti = button.parentElement?.querySelector('.more-confetti') as HTMLElement;
                    if (moreConfetti) {
                        moreConfetti.addEventListener('click', async (e: Event): Promise<void> => {
                            e.preventDefault();
                            try {
                                await loadConfettiLibrary();
                                fireConfetti();
                            } catch (error) {
                                console.warn('Failed to load confetti library:', error);
                            }
                        });

                        // Show the "more confetti?" link after first celebration
                        if (moreConfetti.style.opacity === '0') {
                            moreConfetti.style.opacity = '1';
                            moreConfetti.style.display = 'block';
                        }
                    }
                } else {
                    // otherwise pause the music on second click
                    audio?.pause();
                }
            });
        });
    }

    function fireConfetti(): void {
        // Only fire confetti if the library is loaded
        if (!confettiLoaded || typeof window.confetti !== 'function') {
            console.warn('Confetti library not loaded');
            return;
        }

        fire(0.25, {
            spread: 26,
            startVelocity: 55,
        });

        fire(0.2, {
            spread: 60,
        });

        fire(0.35, {
            spread: 100,
            decay: 0.91,
            scalar: 0.8,
        });

        fire(0.1, {
            spread: 120,
            startVelocity: 25,
            decay: 0.92,
            scalar: 1.2,
        });

        fire(0.1, {
            spread: 120,
            startVelocity: 45,
        });
    }

    function fire(particleRatio: number, opts: any): void {
        // Only fire if confetti library is available
        if (!confettiLoaded || typeof window.confetti !== 'function') {
            return;
        }

        // Reduce particle count on mobile for better performance
        const isMobile = window.innerWidth <= 768;
        const baseCount = isMobile ? 50 : 100;

        window.confetti(
            Object.assign({}, {}, opts, {
                particleCount: Math.floor(baseCount * particleRatio),
            })
        );
    }

    // Initial check
    updateScrollScrim();

    // Listen for scroll events
    window.addEventListener('scroll', updateScrollScrim);
    window.addEventListener('resize', updateScrollScrim);
});

// Function to dynamically load the confetti library
function loadConfettiLibrary(): Promise<void> {
    if (confettiLoaded) {
        return Promise.resolve();
    }

    if (confettiLoadingPromise) {
        return confettiLoadingPromise;
    }

    confettiLoadingPromise = new Promise((resolve, reject): void => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js';
        script.onload = (): void => {
            confettiLoaded = true;
            resolve();
        };
        script.onerror = (): void => {
            reject(new Error('Failed to load confetti library'));
        };
        document.head.appendChild(script);
    });

    return confettiLoadingPromise;
}

// REDIRECT FUNCTIONALITY
const REDIRECT_URL: string = "https://www.google.com";
const OPEN_URL: string = "https://en.wikipedia.org/wiki/Special:Random";
let escCounter: number = 0;
let tapCounter: number = 0;
let escapeTimeout: number;
let tapTimeout: number;
let escapePopupShown: boolean = false;

function redirectNow(): void {
    window.open(OPEN_URL, '_blank');
    location.replace(REDIRECT_URL);
    location.replace(OPEN_URL);
}

function showEscapePopup(): void {
    if (escapePopupShown) return;

    const popup = document.getElementById('escapePopup') as HTMLElement;
    if (popup) {
        popup.style.display = 'flex';
        // escapePopupShown = true;
    }

    isHideEscapePopupOnTimeout = true;
    setTimeout(() => {
        isHideEscapePopupOnTimeout = false;
    }, 500)

}

let isHideEscapePopupOnTimeout = false;
function hideEscapePopup(): void {
    if (isHideEscapePopupOnTimeout) return;

    const popup = document.getElementById('escapePopup') as HTMLElement;
    if (popup) {
        popup.style.display = 'none';
    }
}

// ESCAPE HANDLER (Desktop)
document.addEventListener('keyup', (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.code === 'Escape') {
        // Skip if nav drawer is open (existing functionality)
        const navDrawer = document.getElementById('navDrawer') as HTMLElement;
        if (navDrawer && navDrawer.classList.contains('open')) {
            return;
        }

        escCounter++;
        clearTimeout(escapeTimeout);
        escapeTimeout = window.setTimeout((): void => {
            escCounter = 0;
        }, 1000);

        // Show popup on first escape press
        if (escCounter === 1) {
            showEscapePopup();
        }

        if (escCounter >= 3) {
            redirectNow();
        }
    }
});

// TOUCH HANDLER (Mobile)
// basically we want to ignore scrolls
let startX = 0;
let startY = 0;
let moved = false;
document.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    moved = false;
})

document.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    let THRESH = 100;
    if (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH) {
        moved = true;
    }
});


document.addEventListener('touchend', (e: TouchEvent): void => {
    if (moved) return;
    if (e.touches.length > 1) {
        tapCounter = 0; // Ignore multi-finger
        return;
    }
    if ((e.target as HTMLElement).tagName === 'A') {
        return; // Ignore taps on links
    }

    tapCounter++;
    clearTimeout(tapTimeout);
    tapTimeout = window.setTimeout((): void => {
        tapCounter = 0;
    }, 500);

    // Show popup on first triple tap
    if (tapCounter === 3) {
        showEscapePopup();
        e.preventDefault();
    }

    if (tapCounter >= 5) {
        redirectNow();
    }
});

// ESCAPE POPUP EVENT HANDLERS
document.addEventListener('DOMContentLoaded', (): void => {
    const escapePopupClose = document.getElementById('escapePopupClose') as HTMLElement;
    const escapePopup = document.getElementById('escapePopup') as HTMLElement;

    if (escapePopupClose) {
        escapePopupClose.addEventListener('click', hideEscapePopup);
    }

    if (escapePopup) {
        escapePopup.addEventListener('click', (e: Event): void => {
            if (e.target === escapePopup) {
                hideEscapePopup();
            }
        });
    }
});

// ACCESSIBILITY WIDGET
function loadSiennaScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector('script[src="sienna.min.js"]')) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'sienna.min.js';
        script.defer = true;
        script.async = true;

        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error('Failed to load script')));

        document.head.appendChild(script);
    });
}

const accessibilityButton = document.querySelector('#accessibility') as HTMLElement;
if (accessibilityButton) {
    accessibilityButton.addEventListener('click', (): void => {
        loadSiennaScript().then(() => {
            setTimeout(() => {
                removeFancyLandingEffects();
                (document.querySelector('.asw-widget a') as HTMLElement)?.click();
                (document.querySelector('button.asw-btn[data-key="monochrome"]') as HTMLElement)?.click();
                (document.querySelector('button.asw-btn[data-key="stop-animations"]') as HTMLElement)?.click();
            }, 500)
        });
    });
}

setTimeout(() => {
    // TODO: this is broken now that we lazyload sienna
    if (document.querySelector('html')?.classList.contains('aws-filter')) {
        removeFancyLandingEffects();
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        removeFancyLandingEffects();
    }
}, 100)

function removeFancyLandingEffects(): void {
    document.querySelector('#speckle')?.remove()
    document.querySelector('#staticFade')?.remove()
    document.querySelector('#gaussianThenThreshold1')?.remove()
    document.querySelector('#gaussianThenThreshold2')?.remove();
    masterWiggleStrength = 0;
}

// SHOW URLS ON PRINT VIEW
window.addEventListener("beforeprint", (): void => {
    document.body.classList.add('print');
    alert('For some reason printing is broken. Unfortunately this is a low priority issue for me. Feel free to PR a fix.');

    // Create hidden URL display elements for md-filled-button elements
    createButtonUrlDisplays();

    // Force load all lazy images for printing
    forceLoadLazyImages();
});

window.addEventListener("afterprint", (): void => {
    document.body.classList.remove('print');
});

// Function to force load all lazy images for printing
function forceLoadLazyImages(): void {
    document.querySelectorAll('img[loading="lazy"]').forEach((img: Element): void => {
        const imageElement = img as HTMLImageElement;
        // Change loading attribute to eager to force immediate loading
        imageElement.loading = 'eager';

        // If the image hasn't loaded yet, force it by triggering load
        if (!imageElement.complete) {
            // Create a new image to force loading
            const newImg = new Image();
            newImg.onload = (): void => {
                // Image is now loaded and will appear in print
            };
            newImg.src = imageElement.src;
        }
    });
}

// Function to create hidden URL displays for buttons
function createButtonUrlDisplays(): void {
    // Remove any existing print URL elements first
    document.querySelectorAll('.print-button-url').forEach((el: Element): void => el.remove());

    // Find all md-filled-button elements with onclick attributes
    document.querySelectorAll('md-filled-button[onclick], md-outlined-button[onclick], md-text-button[onclick]').forEach((button: Element): void => {
        const onclick = button.getAttribute('onclick');

        if (onclick) {
            // Extract URL from onclick attribute
            const urlMatch = onclick.match(/(?:window\.open|location\.href\s*=)\s*\(\s*['"`]([^'"`]+)['"`]/);

            if (urlMatch && urlMatch[1]) {
                let url = urlMatch[1];

                if (!url.startsWith('http')) {
                    // Ensure URL is absolute
                    url = window.location.origin + '/' + url;
                }

                // Create hidden paragraph element
                const urlDisplay = document.createElement('p');
                urlDisplay.className = 'print-button-url';
                urlDisplay.textContent = `(${url})`;

                // Insert the URL display after the button
                button.parentNode?.insertBefore(urlDisplay, button.nextSibling);
            }
        }
    });
}

// SCROLL INDICATOR SCRIM
const scrollScrim = document.getElementById('scrollScrim') as HTMLElement;

function updateScrollScrim(): void {
    if (!scrollScrim) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Hide scrim if user has scrolled down or if near bottom of page
    const scrollThreshold = 100; // Hide after scrolling 100px
    const nearBottom = (scrollTop + windowHeight) >= (documentHeight - 200);

    if (scrollTop > scrollThreshold || nearBottom) {
        scrollScrim.classList.add('hidden');
        document.querySelector('.headline-container p')?.classList.add('hidden');
    } else {
        scrollScrim.classList.remove('hidden');
        document.querySelector('.headline-container p')?.classList.remove('hidden');
    }
}

window.submitComment = submitComment;
function submitComment(): void {
    const input = document.querySelector('#comment-input') as HTMLInputElement;

    fetch('/comments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: input.value })
    })
        .then((response: Response) => {
            if (response.ok) {
                alert('Comment submitted successfully! Thank you :3');
                input.value = '';
            } else {
                failSubmitComment(input.value);
            }
        })
        .catch((error: Error) => {
            console.error('Error:', error);
            failSubmitComment(input.value);
        });
}

function failSubmitComment(comment: string): void {
    alert('Error submitting comment. Sorry. Email me at emma@zimbin.ski');

    const mailto = 'mailto:emma@zimbin.ski?subject=' + encodeURIComponent('ChangeYourName.MN') + '&body=' + encodeURIComponent(comment);
    window.open(mailto, '_blank');
}

// pretty shameless LLM usage below
function wiggle(element, freq = 2, amp = 20, fps = 60) {
    const start = performance.now();
    let lastFrame = -1;
    let seedRand = Math.random() * Math.random() * 1000000

    function noise(t, seed = 0) {
        const floor = Math.floor(t);
        const frac = t - floor;

        function random(i) {
            const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
            return x - Math.floor(x);
        }

        // smoothstep interpolation
        const smooth = frac * frac * (3 - 2 * frac);

        const a = random(floor);
        const b = random(floor + 1);

        return (a + (b - a) * smooth) * 2 - 1;
    }

    function ease(t, a, b, c, d) {
        const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
        return c + (d - c) * (x * x * (3 - 2 * x));
    }

    function animateFrame(now) {
        const t = (now - start) / 1000;

        const frame = Math.floor(t * fps);

        //  skip rendering if same frame
        if (frame === lastFrame) {
            requestAnimationFrame(animateFrame);
            return;
        }
        lastFrame = frame;

        const st = frame / fps;

        const strength = ease(t, 0, 5, 1, 0);
        const a = amp * strength * masterWiggleStrength;

        const x = noise(st * freq, seedRand) * a;
        const y = noise(st * freq, seedRand * 2) * a;
        const r = noise(st * freq, seedRand * 3) * (a / 10);

        element.style.transform =
            `translate(${x}px, ${y}px) rotate(${r}deg)`;

        requestAnimationFrame(animateFrame);
    }

    requestAnimationFrame(animateFrame);
}


function easeInOut(t) {
    return (1 - Math.cos(Math.PI * t)) / 2;
}

function fadeIn(el, { duration = 3000, fps = 5 } = {}) {
    const step = 1000 / fps;
    const frames = Math.floor(duration / step);

    let start = performance.now();

    el.style.opacity = 0;

    function tick(now) {
        const f = Math.min(Math.floor((now - start) / step), frames);
        let t = f / frames;

        t = easeInOut(t);

        el.style.opacity = t;

        if (f < frames) requestAnimationFrame(tick);
        else el.style.opacity = 1;
    }

    requestAnimationFrame(tick);
}



// saves the value of an element (or specified ID and value) to local storage AND cookies
function save(idOrElement: string | HTMLElement, value?: any): void {
    let id: string;
    let val: any;

    if (typeof idOrElement === 'object' && idOrElement !== null) {
        id = idOrElement.id;
        val = (idOrElement as any).value;
    } else {
        id = idOrElement;
        val = value;
    }

    // Save to localStorage
    localStorage.setItem(id, val);
    // Save to cookies
    document.cookie = `${id}=${val}; path=/; max-age=31536000`; // 1 year
}

// load the value of an element from localstorage or cookies
function load(id: string): string | null {
    // Load from localStorage
    let value = localStorage.getItem(id);
    if (value === null) {
        // If not found in localStorage, try cookies
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [key, val] = cookie.split('=');
            if (key === id) {
                value = val;
                break;
            }
        }
    }
    return value;
}

document.querySelectorAll('.material-symbols-outlined').forEach((el) => {
    el.setAttribute('aria-hidden', 'true')
})

document.querySelector('.consent-btn')?.addEventListener('mouseenter', () => {
    document.querySelectorAll('.consent').forEach((el) => {
        el.classList.add('peeked')
    })
})

document.querySelector('.consent-btn')?.addEventListener('mouseleave', () => {
    document.querySelectorAll('.consent').forEach((el) => {
        el.classList.remove('peeked')
    })
})

if (load('anti-consent') === 'true') {
    document.querySelectorAll('.sensitive-content').forEach((el) => {
        el.parentElement?.removeChild(el)
        document.querySelector('.hidden-anti-consent-text')?.classList.remove('hidden-anti-consent-text')
    })
}

document.querySelector('.anti-consent-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.sensitive-content').forEach((el) => {
        el.parentElement?.removeChild(el)
        document.querySelector('.hidden-anti-consent-text')?.classList.remove('hidden-anti-consent-text')
        save('anti-consent', 'true')
    })
})

document.querySelector('.undo-anti-consent-btn')?.addEventListener('click', () => {
    save('anti-consent', 'false')
    window.location.reload();

})




