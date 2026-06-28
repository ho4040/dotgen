import { useState, type ReactNode } from 'react';

export interface TabDef {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

interface TabsProps {
  readonly tabs: readonly TabDef[];
  /** Notified with the id of the newly-active tab (also fires for the initial tab). */
  readonly onActiveChange?: (id: string) => void;
}

/** Simple accessible tabs. All panels stay mounted (state preserved); inactive
 * ones are hidden, so switching tabs keeps scroll/open state. */
export function Tabs({ tabs, onActiveChange }: TabsProps) {
  const [active, setActive] = useState<string>(tabs.length > 0 ? tabs[0].id : '');

  const select = (id: string): void => {
    setActive(id);
    onActiveChange?.(id);
  };

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={`tab${tab.id === active ? ' tab--active' : ''}`}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={tab.id !== active} className="tabs__panel">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
