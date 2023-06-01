import React from 'react';

import { createBrowserHistory as createHistory, Path, Location } from 'history';
import { createRouter, PlainOrThunk } from './uss-router';
import UssRouter from './uss-router/Router';

import qs from 'qs';
import Route from 'route-parser';

import * as actions from './actions';
import State from './state';
import { Channel, Edition, Mode, Page } from './types';

const homeRoute = new Route(process.env.PUBLIC_URL + '');
const helpRoute = new Route(process.env.PUBLIC_URL +'/help');

interface Substate {
  page: Page;
  configuration: {
    channel: Channel;
    mode: Mode;
    edition: Edition;
  }
}

const stateSelector = ({ page, configuration: { channel, mode, edition } }: State): Substate => ({
  page,
  configuration: {
    channel,
    mode,
    edition,
  },
});

const stateToLocation = ({ page, configuration }: Substate): Partial<Path> => {
  switch (page) {
    case 'help': {
      return {
        pathname: `${process.env.PUBLIC_URL}/help`,
      };
    }

    default: {
      const query = {
        version: configuration.channel,
        mode: configuration.mode,
        edition: configuration.edition,
      };
      return {
        pathname: `${process.env.PUBLIC_URL}/?${qs.stringify(query)}`,
      };
    }
  }
};

const locationToAction = (location: Location): PlainOrThunk<State, actions.Action> | null => {
  const matchedHelp = helpRoute.match(location.pathname);

  if (matchedHelp) {
    return actions.helpPageLoad();
  }

  const matched = homeRoute.match(location.pathname);

  if (matched) {
    return actions.indexPageLoad(qs.parse(location.search.slice(1)));
  }

  return null;
};

export default class Router extends React.Component<RouterProps> {
  private router: any;

  public constructor(props: RouterProps) {
    super(props);

    const history = createHistory();

    const { store, reducer } = props;

    this.router = createRouter({
      store, reducer,
      history, stateSelector, locationToAction, stateToLocation,
    });
  }

  public render() {
    return <UssRouter router={this.router}>{this.props.children}</UssRouter>;
  }
}

interface RouterProps {
  store: any;
  reducer: any;
}
