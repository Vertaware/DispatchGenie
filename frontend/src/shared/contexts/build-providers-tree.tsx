import React, { ComponentType } from "react";

type ComponentWithProps = [ComponentType<any>, Record<string, any>?];

export default function buildProvidersTree(componentsWithProps: ComponentWithProps[]) {
  const initialComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>{children}</>
  );

  return componentsWithProps.reduce((AccumulatedComponents, [Provider, props = {}]) => {
    const WrappedComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <AccumulatedComponents>
        <Provider {...props}>{children}</Provider>
      </AccumulatedComponents>
    );

    return WrappedComponent;
  }, initialComponent);
}
