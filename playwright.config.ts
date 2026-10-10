import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests/e2e',workers:1,timeout:90000,expect:{timeout:12000},reporter:[['list'],['html',{open:'never'}]],use:{trace:'retain-on-failure',screenshot:'only-on-failure'}})
