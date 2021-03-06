/*
 * Copyright 2015 Palantir Technologies, Inc. All rights reserved.
 *
 * Licensed under the terms of the LICENSE file distributed with this project.
 */

import { assert } from "chai";
import { mount, ReactWrapper, shallow } from "enzyme";
import * as React from "react";
import { Arrow, Target } from "react-popper";
import * as sinon from "sinon";

import { dispatchMouseEvent, expectPropValidationError } from "@blueprintjs/test-commons";

import * as Classes from "../../src/common/classes";
import * as Errors from "../../src/common/errors";
import * as Keys from "../../src/common/keys";
import { Position } from "../../src/common/position";
import { Overlay } from "../../src/components/overlay/overlay";
import { IPopoverProps, IPopoverState, Popover, PopoverInteractionKind } from "../../src/components/popover/popover";
import { Tooltip } from "../../src/components/tooltip/tooltip";
import { Portal } from "../../src/index";

describe("<Popover>", () => {
    let testsContainerElement: HTMLElement;
    let wrapper: IPopoverWrapper;
    const onInteractionSpy = sinon.spy();

    beforeEach(() => {
        testsContainerElement = document.createElement("div");
        document.body.appendChild(testsContainerElement);
    });

    afterEach(() => {
        if (wrapper !== undefined) {
            // clean up wrapper to remove Portal element from DOM
            wrapper.unmount();
            wrapper.detach();
            wrapper = undefined;
        }
        testsContainerElement.remove();
        onInteractionSpy.resetHistory();
    });

    describe("validation:", () => {
        it("throws error if given no target", () => {
            expectPropValidationError(Popover, {}, Errors.POPOVER_REQUIRES_TARGET);
        });

        it("warns if given > 2 target elements", () => {
            // use sinon.stub to prevent warnings from appearing in the test logs
            const warnSpy = sinon.stub(console, "warn");
            shallow(
                <Popover>
                    <h1 />
                    <h2 />
                    {"h3"}
                </Popover>,
            );
            assert.isTrue(warnSpy.calledWith(Errors.POPOVER_WARN_TOO_MANY_CHILDREN));
            warnSpy.restore();
        });

        it("warns if given children and target prop", () => {
            const warnSpy = sinon.stub(console, "warn");
            shallow(<Popover target="boom">pow</Popover>);
            assert.isTrue(warnSpy.calledWith(Errors.POPOVER_WARN_DOUBLE_TARGET));
            warnSpy.restore();
        });

        it("warns if given two children and content prop", () => {
            const warnSpy = sinon.stub(console, "warn");
            shallow(
                <Popover content="boom">
                    {"pow"}
                    {"jab"}
                </Popover>,
            );
            assert.isTrue(warnSpy.calledWith(Errors.POPOVER_WARN_DOUBLE_CONTENT));
            warnSpy.restore();
        });

        it("warns if attempting to open a popover with empty content", () => {
            const warnSpy = sinon.stub(console, "warn");
            shallow(
                <Popover content={null} isOpen={true}>
                    {"target"}
                </Popover>,
            );
            assert.isTrue(warnSpy.calledWith(Errors.POPOVER_WARN_EMPTY_CONTENT));
            warnSpy.restore();
        });

        it("warns if backdrop enabled when rendering inline", () => {
            const warnSpy = sinon.stub(console, "warn");
            shallow(
                <Popover hasBackdrop={true} usePortal={false}>
                    {"target"}
                    {"content"}
                </Popover>,
            );
            assert.isTrue(warnSpy.calledWith(Errors.POPOVER_WARN_HAS_BACKDROP_INLINE));
            warnSpy.restore();
        });

        describe("throws error if backdrop enabled with non-CLICK interactionKind", () => {
            runErrorTest("HOVER");
            runErrorTest("HOVER_TARGET_ONLY");
            runErrorTest("CLICK_TARGET_ONLY");

            it("doesn't throw error for CLICK", () => {
                assert.doesNotThrow(() => (
                    <Popover hasBackdrop={true} interactionKind={PopoverInteractionKind.CLICK} />
                ));
            });

            function runErrorTest(interactionKindKey: keyof typeof PopoverInteractionKind) {
                it(interactionKindKey, () => {
                    expectPropValidationError(
                        Popover,
                        { hasBackdrop: true, interactionKind: PopoverInteractionKind[interactionKindKey] },
                        Errors.POPOVER_HAS_BACKDROP_INTERACTION,
                    );
                });
            }
        });
    });

    it("propagates class names correctly", () => {
        wrapper = renderPopover({
            className: "bar",
            interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY,
            popoverClassName: "foo",
            targetClassName: "baz",
        }).simulateTarget("click");
        assert.isTrue(wrapper.findClass(Classes.POPOVER).hasClass("foo"));
        assert.isTrue(wrapper.findClass(Classes.POPOVER_WRAPPER).hasClass("bar"));
        assert.isTrue(wrapper.findClass(Classes.POPOVER_TARGET).hasClass("baz"));
    });

    it("adds .pt-popover-open class to target when the popover is open", () => {
        wrapper = renderPopover();
        assert.isFalse(wrapper.findClass(Classes.POPOVER_TARGET).hasClass(Classes.POPOVER_OPEN));
        wrapper.setState({ isOpen: true });
        assert.isTrue(wrapper.findClass(Classes.POPOVER_TARGET).hasClass(Classes.POPOVER_OPEN));
    });

    it("renders Portal when usePortal=true", () => {
        wrapper = renderPopover({ isOpen: true, usePortal: true });
        assert.lengthOf(wrapper.find(Portal).find(`.${Classes.POPOVER}`), 1);
    });

    it("does not render Portal when usePortal=false", () => {
        wrapper = renderPopover({ isOpen: true, usePortal: false });
        assert.lengthOf(wrapper.find(Portal).find(`.${Classes.POPOVER}`), 0);
    });

    it("empty content disables it and warns", () => {
        const warnSpy = sinon.stub(console, "warn");
        const popover = mount(
            <Popover content={undefined} isOpen={true}>
                <button />
            </Popover>,
        );
        assert.isFalse(popover.find(Overlay).prop("isOpen"), "not open for undefined content");

        assert.equal(warnSpy.callCount, 1);

        popover.setProps({ content: "    " });
        assert.isFalse(popover.find(Overlay).prop("isOpen"), "not open for white-space string content");

        assert.equal(warnSpy.callCount, 2);
        warnSpy.restore();
    });

    it("lifecycle methods are called appropriately", () => {
        const popoverWillOpen = sinon.spy(() =>
            assert.lengthOf(testsContainerElement.getElementsByClassName(Classes.POPOVER), 0),
        );
        const popoverDidOpen = sinon.spy(() =>
            assert.lengthOf(testsContainerElement.getElementsByClassName(Classes.POPOVER), 1),
        );
        const popoverWillClose = sinon.spy(() =>
            assert.lengthOf(testsContainerElement.getElementsByClassName(Classes.POPOVER), 1),
        );

        wrapper = renderPopover({
            interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY,
            popoverDidOpen,
            popoverWillClose,
            popoverWillOpen,
        }).simulateTarget("click");
        assert.isTrue(popoverWillOpen.calledOnce);
        assert.isTrue(popoverDidOpen.calledOnce);
        assert.isTrue(popoverWillClose.notCalled);

        wrapper.simulateTarget("click");
        assert.isTrue(popoverDidOpen.calledOnce);
        assert.isTrue(popoverWillOpen.calledOnce);
        assert.isTrue(popoverWillClose.calledOnce);
    });

    it("popoverDidOpen is called even if popoverWillOpen is not specified", () => {
        const popoverDidOpen = sinon.spy();
        renderPopover({
            interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY,
            popoverDidOpen,
        }).simulateTarget("click");

        assert.isTrue(popoverDidOpen.calledOnce);
    });

    it("inherits .pt-dark from trigger ancestor", () => {
        testsContainerElement.classList.add(Classes.DARK);
        const { popover } = renderPopover({ isOpen: true, inheritDarkTheme: true, usePortal: true });
        assert.isTrue(popover.matches(`.${Classes.DARK}`));
        testsContainerElement.classList.remove(Classes.DARK);
    });

    it("inheritDarkTheme=false disables inheriting .pt-dark from trigger ancestor", () => {
        testsContainerElement.classList.add(Classes.DARK);
        const { popover } = renderPopover({ inheritDarkTheme: false, isOpen: true, usePortal: true });
        assert.isFalse(popover.matches(`.${Classes.DARK}`));
        testsContainerElement.classList.remove(Classes.DARK);
    });

    it("allows user to apply dark theme explicitly", () => {
        const { popover } = renderPopover({
            isOpen: true,
            popoverClassName: Classes.DARK,
            usePortal: false,
        });
        assert.isNotNull(popover.matches(`.${Classes.DARK}`));
    });

    it("hasBackdrop=false does not render backdrop element", () => {
        const { popover } = renderPopover({ hasBackdrop: false, isOpen: true, usePortal: true });
        assert.lengthOf(popover.parentElement.getElementsByClassName(Classes.POPOVER_BACKDROP), 0);
    });

    it("hasBackdrop=true renders backdrop element", () => {
        const { popover } = renderPopover({ hasBackdrop: true, isOpen: true, usePortal: true });
        const expectedBackdrop = popover.parentElement.previousElementSibling;
        assert.isTrue(expectedBackdrop.matches(`.${Classes.POPOVER_BACKDROP}`));
    });

    it("rootElementTag prop renders the right elements", () => {
        wrapper = renderPopover({ isOpen: true, rootElementTag: "article" });
        assert.isNotNull(wrapper.find("article"));
    });

    describe("openOnTargetFocus", () => {
        describe("if true (default)", () => {
            it('adds tabindex="0" to target\'s child node when interactionKind is HOVER', () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.HOVER, true, true);
            });

            it('adds tabindex="0" to target\'s child node when interactionKind is HOVER_TARGET_ONLY', () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.HOVER_TARGET_ONLY, true, true);
            });

            it("does not add tabindex to target's child node when interactionKind is CLICK", () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.CLICK, false, true);
            });

            it("does not add tabindex to target's child node when interactionKind is CLICK_TARGET_ONLY", () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.CLICK_TARGET_ONLY, false, true);
            });

            it("opens popover on target focus when interactionKind is HOVER", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.HOVER, true);
            });

            it("opens popover on target focus when interactionKind is HOVER_TARGET_ONLY", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.HOVER_TARGET_ONLY, true);
            });

            it("does not open popover on target focus when interactionKind is CLICK", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.CLICK, false);
            });

            it("does not open popover on target focus when interactionKind is CLICK_TARGET_ONLY", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.CLICK_TARGET_ONLY, false);
            });

            it.skip("closes popover on target blur if autoFocus={false}", () => {
                // TODO (clewis): This is really tricky to test given the setTimeout in the onBlur implementation.
            });

            it("popover remains open after target focus if autoFocus={true}", () => {
                wrapper = renderPopover({
                    autoFocus: true,
                    interactionKind: PopoverInteractionKind.HOVER,
                    usePortal: true,
                });
                const targetElement = wrapper.findClass(Classes.POPOVER_TARGET);
                targetElement.simulate("focus");
                targetElement.simulate("blur");
                assert.isTrue(wrapper.state("isOpen"));
            });
        });

        describe("if false", () => {
            it("does not add tabindex to target's child node when interactionKind is HOVER", () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.HOVER, false, false);
            });

            it("does not add tabindex to target's child node when interactionKind is HOVER_TARGET_ONLY", () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.HOVER_TARGET_ONLY, false, false);
            });

            it("does not add tabindex to target's child node when interactionKind is CLICK", () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.CLICK, false, false);
            });

            it("does not add tabindex to target's child node when interactionKind is CLICK_TARGET_ONLY", () => {
                assertPopoverTargetTabIndex(PopoverInteractionKind.CLICK_TARGET_ONLY, false, false);
            });

            it("does not open popover on target focus when interactionKind is HOVER", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.HOVER, false, false);
            });

            it("does not open popover on target focus when interactionKind is HOVER_TARGET_ONLY", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.HOVER_TARGET_ONLY, false, false);
            });

            it("does not open popover on target focus when interactionKind is CLICK", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.CLICK, false, false);
            });

            it("does not open popover on target focus when interactionKind is CLICK_TARGET_ONLY", () => {
                assertPopoverOpenStateForInteractionKind(PopoverInteractionKind.CLICK_TARGET_ONLY, false, false);
            });
        });

        function assertPopoverOpenStateForInteractionKind(
            interactionKind: PopoverInteractionKind,
            isOpen: boolean,
            openOnTargetFocus?: boolean,
        ) {
            wrapper = renderPopover({
                interactionKind,
                openOnTargetFocus,
                usePortal: true,
            });
            const targetElement = wrapper.findClass(Classes.POPOVER_TARGET);
            targetElement.simulate("focus");
            assert.equal(wrapper.state("isOpen"), isOpen);
        }

        function assertPopoverTargetTabIndex(
            interactionKind: PopoverInteractionKind,
            shouldTabIndexExist: boolean,
            openOnTargetFocus?: boolean,
        ) {
            wrapper = renderPopover({ interactionKind, openOnTargetFocus, usePortal: true });
            const targetElement = wrapper
                .findClass(Classes.POPOVER_TARGET)
                .childAt(0)
                .getDOMNode();

            if (shouldTabIndexExist) {
                assert.equal(targetElement.getAttribute("tabindex"), "0");
            } else {
                assert.isNull(targetElement.getAttribute("tabindex"));
            }
        }
    });

    describe("in controlled mode", () => {
        it("state respects isOpen prop", () => {
            renderPopover()
                .assertIsOpen(false)
                .setProps({ isOpen: true })
                .assertIsOpen();
        });

        it("state does not update on user interaction", () => {
            renderPopover({ isOpen: true })
                .simulateTarget("click")
                .assertIsOpen()
                .setProps({ isOpen: false })
                .simulateTarget("click")
                .assertIsOpen(false);
            renderPopover({ canEscapeKeyClose: true, isOpen: true })
                .sendEscapeKey()
                .assertIsOpen();
        });

        describe("disabled=true takes precedence over isOpen=true", () => {
            it("on mount", () => {
                renderPopover({ disabled: true, isOpen: true }).assertIsOpen(false);
            });

            it("onInteraction not called if changing from closed to open (b/c popover is still closed)", () => {
                renderPopover({ disabled: true, isOpen: false, onInteraction: onInteractionSpy })
                    .assertOnInteractionCalled(false)
                    .setProps({ isOpen: true })
                    .assertIsOpen(false)
                    .assertOnInteractionCalled(false);
            });

            it("onInteraction not called if changing from open to closed (b/c popover was already closed)", () => {
                renderPopover({ disabled: true, isOpen: true, onInteraction: onInteractionSpy })
                    .assertOnInteractionCalled(false)
                    .setProps({ isOpen: false })
                    .assertOnInteractionCalled(false);
            });

            it("onInteraction called if open and changing to disabled (b/c popover will close)", () => {
                renderPopover({ disabled: false, isOpen: true, onInteraction: onInteractionSpy })
                    .assertIsOpen()
                    .assertOnInteractionCalled(false)
                    .setProps({ disabled: true })
                    .assertOnInteractionCalled();
            });

            it("onInteraction called if open and changing to not-disabled (b/c popover will open)", () => {
                renderPopover({ disabled: true, isOpen: true, onInteraction: onInteractionSpy })
                    .assertOnInteractionCalled(false)
                    .setProps({ disabled: false })
                    .assertIsOpen()
                    .assertOnInteractionCalled();
            });
        });

        it("onClose is invoked with event when popover would close", () => {
            const onClose = sinon.spy();
            renderPopover({ isOpen: true, onClose }).simulateTarget("click");
            assert.isTrue(onClose.calledOnce);
            assert.isNotNull(onClose.args[0][0]);
        });

        describe("onInteraction()", () => {
            let onInteraction: sinon.SinonSpy;
            beforeEach(() => (onInteraction = sinon.spy()));

            it("is invoked with `true` when closed popover target is clicked", () => {
                renderPopover({ isOpen: false, onInteraction }).simulateTarget("click");
                assert.isTrue(onInteraction.calledOnce);
                assert.isTrue(onInteraction.calledWith(true));
            });

            it("is invoked with `false` when open popover target is clicked", () => {
                renderPopover({ isOpen: true, onInteraction }).simulateTarget("click");
                assert.isTrue(onInteraction.calledOnce);
                assert.isTrue(onInteraction.calledWith(false));
            });

            it("is invoked with `false` when open modal popover backdrop is clicked", () => {
                renderPopover({
                    backdropProps: { className: "test-hook" },
                    hasBackdrop: true,
                    isOpen: true,
                    onInteraction,
                    usePortal: true,
                });
                dispatchMouseEvent(document.getElementsByClassName("test-hook")[0], "mousedown");
                assert.isTrue(onInteraction.calledOnce, "A");
                assert.isTrue(onInteraction.calledWith(false), "B");
            });

            it("is invoked with `false` when clicking .pt-popover-dismiss", () => {
                renderPopover({ isOpen: true, onInteraction }, <button className="pt-popover-dismiss">Dismiss</button>)
                    .findClass(Classes.POPOVER_DISMISS)
                    .simulate("click");
                assert.isTrue(onInteraction.calledOnce);
                assert.isTrue(onInteraction.calledWith(false));
            });

            it("is invoked with `false` when the document is mousedowned", () => {
                renderPopover({ isOpen: true, onInteraction });
                dispatchMouseEvent(document.documentElement, "mousedown");
                assert.isTrue(onInteraction.calledOnce);
                assert.isTrue(onInteraction.calledWith(false));
            });
        });
    });

    describe("in uncontrolled mode", () => {
        it("setting defaultIsOpen=true renders open popover", () => {
            renderPopover({ defaultIsOpen: true }).assertIsOpen();
        });

        it("with defaultIsOpen=true, popover can still be closed", () => {
            renderPopover({ defaultIsOpen: true })
                .assertIsOpen()
                .simulateTarget("click")
                .assertIsOpen(false);
        });

        it("CLICK_TARGET_ONLY works properly", () => {
            renderPopover({ interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY })
                .simulateTarget("click")
                .assertIsOpen()
                .simulateTarget("click")
                .assertIsOpen(false);
        });

        it("HOVER_TARGET_ONLY works properly", done => {
            renderPopover({ interactionKind: PopoverInteractionKind.HOVER_TARGET_ONLY, usePortal: true })
                .simulateTarget("mouseenter")
                .assertIsOpen()
                .simulateTarget("mouseleave")
                .then(popover => popover.assertIsOpen(false), done);
        });

        it("inline HOVER_TARGET_ONLY works properly when openOnTargetFocus={false}", done => {
            wrapper = renderPopover({
                interactionKind: PopoverInteractionKind.HOVER_TARGET_ONLY,
                openOnTargetFocus: false,
                usePortal: false,
            });

            wrapper.simulateTarget("mouseenter").assertIsOpen();
            wrapper.findClass(Classes.POPOVER).simulate("mouseenter");
            // Popover defers popover closing, so need to defer this check
            wrapper.then(() => wrapper.assertIsOpen(false), done);
        });

        it("inline HOVER works properly", done => {
            wrapper = renderPopover({ interactionKind: PopoverInteractionKind.HOVER, usePortal: false });

            wrapper.simulateTarget("mouseenter").assertIsOpen();

            wrapper.findClass(Classes.POPOVER).simulate("mouseenter");
            wrapper.assertIsOpen();

            wrapper.findClass(Classes.POPOVER).simulate("mouseleave");
            // Popover defers popover closing, so need to defer this check
            wrapper.then(() => wrapper.assertIsOpen(false), done);
        });

        it("clicking .pt-popover-dismiss closes popover when usePortal=true", () => {
            wrapper = renderPopover(
                {
                    interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY,
                    usePortal: true,
                },
                <button className="pt-popover-dismiss">Dismiss</button>,
            );

            wrapper.simulateTarget("click").assertIsOpen();

            dispatchMouseEvent(document.getElementsByClassName(Classes.POPOVER_DISMISS)[0], "click");
            wrapper.update().assertIsOpen(false);
        });

        it("clicking .pt-popover-dismiss closes popover when usePortal=false", () => {
            wrapper = renderPopover(
                {
                    interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY,
                    usePortal: false,
                },
                <button className="pt-popover-dismiss">Dismiss</button>,
            );

            wrapper.simulateTarget("click").assertIsOpen();

            wrapper.findClass(Classes.POPOVER_DISMISS).simulate("click");
            wrapper.assertIsOpen(false);
        });

        it("pressing Escape closes popover when canEscapeKeyClose=true and usePortal=false", () => {
            renderPopover({ canEscapeKeyClose: true, usePortal: false })
                .simulateTarget("click")
                .assertIsOpen()
                .sendEscapeKey()
                .assertIsOpen(false);
        });

        it("setting disabled=true prevents opening popover", () => {
            renderPopover({
                disabled: true,
                interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY,
            })
                .simulateTarget("click")
                .assertIsOpen(false);
        });

        it("setting disabled=true hides open popover", () => {
            renderPopover({ interactionKind: PopoverInteractionKind.CLICK_TARGET_ONLY })
                .simulateTarget("click")
                .assertIsOpen()
                .setProps({ disabled: true })
                .assertIsOpen(false);
        });

        it.skip("console.warns if onInteraction is set", () => {
            const warnSpy = sinon.stub(console, "warn");
            renderPopover({ onInteraction: () => false });
            assert.strictEqual(warnSpy.firstCall.args[0], Errors.POPOVER_WARN_UNCONTROLLED_ONINTERACTION);
            warnSpy.restore();
        });
    });

    describe("when composed with <Tooltip>", () => {
        let root: ReactWrapper<any, any>;
        beforeEach(() => {
            root = mount(
                <Popover content="popover" hoverOpenDelay={0} hoverCloseDelay={0} usePortal={false}>
                    <Tooltip content="tooltip" hoverOpenDelay={0} hoverCloseDelay={0} usePortal={false}>
                        <button>Target</button>
                    </Tooltip>
                </Popover>,
                { attachTo: testsContainerElement },
            );
        });
        afterEach(() => root.detach());

        it("shows tooltip on hover", () => {
            root
                .find(`.${Classes.POPOVER_TARGET}`)
                .last()
                .simulate("mouseenter");
            assert.lengthOf(root.find(`.${Classes.TOOLTIP}`), 1);
        });

        it("shows popover on click", () => {
            root
                .find(`.${Classes.POPOVER_TARGET}`)
                .first()
                .simulate("click");
            assert.lengthOf(root.find(`.${Classes.POPOVER}`), 1);
        });
    });

    describe("Popper.js integration", () => {
        it("renders arrow element by default", () => {
            wrapper = renderPopover({ isOpen: true });
            assert.lengthOf(wrapper.find(Arrow), 1);
        });

        it("arrow can be disabled via modifiers", () => {
            wrapper = renderPopover({ isOpen: true, modifiers: { arrow: { enabled: false } } });
            assert.lengthOf(wrapper.find(Arrow), 0);
        });

        it("arrow can be disabled via minimal prop", () => {
            wrapper = renderPopover({ minimal: true, isOpen: true });
            assert.lengthOf(wrapper.find(Arrow), 0);
        });

        it("computes arrow rotation", done => {
            renderPopover({ isOpen: true, position: Position.TOP }).then(
                () => assert.equal(wrapper.state("arrowRotation"), 90),
                done,
            );
        });

        it("computes transformOrigin with arrow", done => {
            // unreliable to test actual state value as it depends on browser (chrome and karma behave differently).
            // so we'll just check that state was set _at all_ (it starts undefined).
            renderPopover({ isOpen: true }).then(() => assert.isDefined(wrapper.state("transformOrigin")), done);
        });

        it("computes transformOrigin without arrow", done => {
            renderPopover({ minimal: true, isOpen: true }).then(
                () => assert.equal(wrapper.state("transformOrigin"), "center top"),
                done,
            );
        });
    });

    interface IPopoverWrapper extends ReactWrapper<IPopoverProps, IPopoverState> {
        popover: HTMLElement;
        assertIsOpen(isOpen?: boolean): this;
        assertOnInteractionCalled(called?: boolean): this;
        simulateTarget(eventName: string): this;
        findClass(className: string): ReactWrapper<React.HTMLAttributes<HTMLElement>, any>;
        sendEscapeKey(): this;
        then(next: (wrap: IPopoverWrapper) => void, done: MochaDone): this;
    }

    function renderPopover(props: Partial<IPopoverProps> = {}, content?: any) {
        wrapper = mount(
            <Popover usePortal={false} {...props} hoverCloseDelay={0} hoverOpenDelay={0}>
                <button>Target</button>
                <p>Text {content}</p>
            </Popover>,
            { attachTo: testsContainerElement },
        ) as IPopoverWrapper;
        wrapper.popover = (wrapper.instance() as Popover).popoverElement;
        wrapper.assertIsOpen = (isOpen = true) => {
            assert.equal(wrapper.find(Overlay).prop("isOpen"), isOpen, "assertIsOpen");
            return wrapper;
        };
        wrapper.assertOnInteractionCalled = (called = true) => {
            assert.strictEqual(onInteractionSpy.called, called, "assertOnInteractionCalled");
            return wrapper;
        };
        wrapper.findClass = (className: string) => wrapper.find(`.${className}`).hostNodes();
        wrapper.simulateTarget = (eventName: string) => {
            wrapper.find(Target).simulate(eventName);
            return wrapper;
        };
        wrapper.sendEscapeKey = () => {
            wrapper.findClass(Classes.OVERLAY_OPEN).simulate("keydown", {
                nativeEvent: new KeyboardEvent("keydown"),
                which: Keys.ESCAPE,
            });
            return wrapper;
        };
        wrapper.then = (next, done) => {
            setTimeout(() => {
                wrapper.update();
                next(wrapper);
                done();
            });
            return wrapper;
        };
        return wrapper;
    }
});
